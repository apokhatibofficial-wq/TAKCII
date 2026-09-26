import { useCallback, useEffect, useRef, useState } from 'react';
import { mediaDevices, RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, type MediaStream } from 'react-native-webrtc';
import { supabase } from '../lib/supabase';
import { ICE_SERVERS, fetchIceServers, callChannelTopic, randomCallId, type CallSignalPayload } from '@takc/shared';

export type CallStatus = 'idle' | 'ringing-incoming' | 'ringing-outgoing' | 'connecting' | 'connected';
export type EndedReason = 'hangup' | 'busy' | 'no-answer' | 'error' | null;

const RING_TIMEOUT_MS = 30000;

// Driver-side twin of the rider app's hook of the same name -- same
// signaling protocol over the ride's private Realtime Broadcast channel
// (0022_voice_call_signaling.sql). react-native-webrtc plays an incoming
// audio track through the device's speaker/earpiece automatically once it
// reaches this peer connection; unlike the web version there is no <audio>
// element to wire up for that.
export function useVoiceCall(rideId: string | null) {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [muted, setMuted] = useState(false);
  const [endedReason, setEndedReason] = useState<EndedReason>(null);

  const myIdRef = useRef<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callIdRef = useRef<string | null>(null);
  const pendingCandidatesRef = useRef<{ candidate: string; sdpMid: string | null; sdpMLineIndex: number | null }[]>([]);
  const incomingOfferRef = useRef<{ callId: string; sdp: string } | null>(null);
  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>(ICE_SERVERS);

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
    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
    pc.onicecandidate = (e: { candidate: RTCIceCandidate | null }) => {
      if (e.candidate && callIdRef.current && myIdRef.current) {
        send({
          kind: 'ice-candidate',
          callId: callIdRef.current,
          from: myIdRef.current,
          candidate: e.candidate.candidate,
          sdpMid: e.candidate.sdpMid ?? null,
          sdpMLineIndex: e.candidate.sdpMLineIndex ?? null
        });
      }
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
            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: payload.sdp }));
            for (const c of pendingCandidatesRef.current) await pc.addIceCandidate(new RTCIceCandidate(c));
            pendingCandidatesRef.current = [];
            clearRingTimer();
            setStatus('connecting');
          }
          return;
        }
        case 'ice-candidate': {
          if (callIdRef.current !== payload.callId) return;
          const init = { candidate: payload.candidate, sdpMid: payload.sdpMid, sdpMLineIndex: payload.sdpMLineIndex };
          const pc = pcRef.current;
          if (pc && pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(init));
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

    fetchIceServers(supabase).then((servers) => {
      iceServersRef.current = servers;
    });

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
      const stream = await mediaDevices.getUserMedia({ audio: true });
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
      const stream = await mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      const pc = createPeerConnection();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: offer.sdp }));
      for (const c of pendingCandidatesRef.current) await pc.addIceCandidate(new RTCIceCandidate(c));
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

  return { status, muted, endedReason, startCall, acceptCall, declineCall, hangUp, toggleMute, clearEndedReason };
}
