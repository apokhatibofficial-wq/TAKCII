// In-app voice calling (rider <-> driver), signaled over a private Supabase
// Realtime Broadcast channel per ride (see 0022_voice_call_signaling.sql).
// No TURN server is configured yet -- STUN alone resolves NAT type/public
// address but cannot relay media, so a call between two peers both behind a
// restrictive/symmetric NAT (common on cellular data) may fail to connect.
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

export function callChannelTopic(rideId: string): string {
  return `ride-call:${rideId}`;
}

// react-native's Hermes engine has no global crypto.randomUUID -- this only
// needs to be unique enough to correlate one call's signals, not a real UUID.
export function randomCallId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export type CallSignalPayload =
  | { kind: 'offer'; callId: string; from: string; sdp: string }
  | { kind: 'answer'; callId: string; from: string; sdp: string }
  | { kind: 'ice-candidate'; callId: string; from: string; candidate: string; sdpMid: string | null; sdpMLineIndex: number | null }
  | { kind: 'hangup'; callId: string; from: string }
  | { kind: 'busy'; callId: string; from: string };
