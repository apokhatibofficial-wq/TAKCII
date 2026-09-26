import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ICE_SERVERS, callChannelTopic, randomCallId, type CallSignalPayload } from '@takc/shared';

export type CallStatus = 'idle' | 'ringing-incoming' | 'ringing-outgoing' | 'connecting' | 'connected';
export type EndedReason = 'hangup' | 'busy' | 'no-answer' | 'error' | null;

const RING_TIMEOUT_MS = 30000;

// In-app voice calling for one ride, signaled over a private Supabase
// Realtime Broadcast channel (topic `ride-call:<rideId>`, authorized by RLS
// on realtime.messages -- see 0022_voice_call_signaling.sql) instead of any
// table: an SDP offer/answer and ICE candidates only matter for the life of
// one call, there is nothing worth persisting. No TURN server is configured
// yet, only public STUN -- a call between two peers both behind a
// restrictive/symmetric NAT (common on cellular data) may fail to connect.
//
// Refs (pcRef/callIdRef/incomingOfferRef), not `status` state, are the real
// state machine -- signal handling only reads/writes those, so it never
// needs `status` in its closure or dependency list.
export function useVoiceCall(rideId: string | null) {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [muted, setMuted] = useState(false);
  const [endedReason, setEndedReason] = useState<EndedReason>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const myIdRef = useRef<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callIdRef = useRef<string | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const incomingOfferRef = useRef<{ callId: string; sdp: string } | null>(null);
  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      myIdRef.current = data.user?.id ?? null;
    });
  }, []);

  const send = useCallback((payload: CallSignalPayload) => {
    channelRef.current?.send({ type: 'broadcast', event: 'signal', payload });
  }, []);

  const clearRingTimer = () => {
    if (ringTimerRef.current) {
      clearTimeout(ringTimerRef.current);
      ringTimerRef.current = null;
    }
  };

  const teardown = useCallback(() => {
    clearRingTimer();
    const pc = pcRef.current;
    if (pc) {
      pc.getSenders().forEach((s) => s.track?.stop());
      pc.close();
    }
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    pendingCandidatesRef.current = [];
    incomingOfferRef.current = null;
    callIdRef.current = null;
    setMuted(false);
  }, []);

  const goIdle = useCallback(
    (reason: EndedReason) => {
      teardown();
      setEndedReason(reason);
      setStatus('idle');
    },
    [teardown]
  );

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (e) => {
      if (e.candidate && callIdRef.current && myIdRef.current) {
        send({
          kind: 'ice-candidate',
          callId: callIdRef.current,
          from: myIdRef.current,
          candidate: e.candidate.candidate,
          sdpMid: e.candidate.sdpMid,
          sdpMLineIndex: e.candidate.sdpMLineIndex
        });
      }
    };
    pc.ontrack = (e) => {
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = e.streams[0] ?? null;
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        clearRingTimer();
        setStatus('connected');
      } else if (pc.connectionState === 'failed') {
        goIdle('error');
      }
    };
    pcRef.current = pc;
    return pc;
  }, [send, goIdle]);

  const handleSignal = useCallback(
    async (payload: CallSignalPayload) => {
      switch (payload.kind) {
        case 'offer': {
          if (pcRef.current || incomingOfferRef.current) {
            if (myIdRef.current) send({ kind: 'busy', callId: payload.callId, from: myIdRef.current });
            return;
          }
          incomingOfferRef.current = { callId: payload.callId, sdp: payload.sdp };
          callIdRef.current = payload.callId;
          setEndedReason(null);
          setStatus('ringing-incoming');
          clearRingTimer();
          ringTimerRef.current = setTimeout(() => {
            if (incomingOfferRef.current?.callId === payload.callId) goIdle(null);
          }, RING_TIMEOUT_MS);
          return;
        }
        case 'answer': {
          const pc = pcRef.current;
          if (pc && callIdRef.current === payload.callId) {
            await pc.setRemoteDescription({ type: 'answer', sdp: payload.sdp });
            for (const c of pendingCandidatesRef.current) await pc.addIceCandidate(c);
            pendingCandidatesRef.current = [];
            clearRingTimer();
            setStatus('connecting');
          }
          return;
        }
        case 'ice-candidate': {
          if (callIdRef.current !== payload.callId) return;
          const init: RTCIceCandidateInit = {
            candidate: payload.candidate,
            sdpMid: payload.sdpMid,
            sdpMLineIndex: payload.sdpMLineIndex ?? undefined
          };
          const pc = pcRef.current;
          if (pc && pc.remoteDescription) {
            await pc.addIceCandidate(init);
          } else {
            pendingCandidatesRef.current.push(init);
          }
          return;
        }
        case 'hangup': {
          if (callIdRef.current === payload.callId || incomingOfferRef.current?.callId === payload.callId) {
            goIdle('hangup');
          }
          return;
        }
        case 'busy': {
          if (callIdRef.current === payload.callId) goIdle('busy');
          return;
        }
      }
    },
    [send, goIdle]
  );

  useEffect(() => {
    channelRef.current?.unsubscribe();
    channelRef.current = null;
    goIdle(null);
    setEndedReason(null);
    if (!rideId) return;

    const channel = supabase.channel(callChannelTopic(rideId), { config: { private: true } });
    channel.on('broadcast', { event: 'signal' }, ({ payload }: { payload: CallSignalPayload }) => {
      if (payload.from === myIdRef.current) return;
      handleSignal(payload);
    });
    channel.subscribe();
    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [rideId, handleSignal, goIdle]);

  useEffect(() => () => teardown(), [teardown]);

  const startCall = useCallback(async () => {
    if (!rideId || pcRef.current || !myIdRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      const pc = createPeerConnection();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      const callId = randomCallId();
      callIdRef.current = callId;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send({ kind: 'offer', callId, from: myIdRef.current, sdp: offer.sdp! });
      setEndedReason(null);
      setStatus('ringing-outgoing');
      ringTimerRef.current = setTimeout(() => {
        if (callIdRef.current === callId && myIdRef.current) {
          send({ kind: 'hangup', callId, from: myIdRef.current });
          goIdle('no-answer');
        }
      }, RING_TIMEOUT_MS);
    } catch {
      goIdle('error');
    }
  }, [rideId, createPeerConnection, send, goIdle]);

  const acceptCall = useCallback(async () => {
    const offer = incomingOfferRef.current;
    if (!offer || !myIdRef.current) return;
    clearRingTimer();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      const pc = createPeerConnection();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      await pc.setRemoteDescription({ type: 'offer', sdp: offer.sdp });
      for (const c of pendingCandidatesRef.current) await pc.addIceCandidate(c);
      pendingCandidatesRef.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send({ kind: 'answer', callId: offer.callId, from: myIdRef.current, sdp: answer.sdp! });
      incomingOfferRef.current = null;
      setStatus('connecting');
    } catch {
      goIdle('error');
    }
  }, [createPeerConnection, send, goIdle]);

  const declineCall = useCallback(() => {
    const offer = incomingOfferRef.current;
    if (!offer || !myIdRef.current) return;
    send({ kind: 'hangup', callId: offer.callId, from: myIdRef.current });
    goIdle(null);
  }, [send, goIdle]);

  const hangUp = useCallback(() => {
    if (callIdRef.current && myIdRef.current) {
      send({ kind: 'hangup', callId: callIdRef.current, from: myIdRef.current });
    }
    goIdle(null);
  }, [send, goIdle]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !muted;
    stream.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
    setMuted(next);
  }, [muted]);

  const clearEndedReason = useCallback(() => setEndedReason(null), []);

  return { status, muted, endedReason, remoteAudioRef, startCall, acceptCall, declineCall, hangUp, toggleMute, clearEndedReason };
}
