import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// In-app voice calling (rider <-> driver), signaled over a private Supabase
// Realtime Broadcast channel per ride (see 0022_voice_call_signaling.sql).
// Google STUN-only fallback, used until fetchIceServers() below resolves (or
// if it fails) -- STUN alone resolves NAT type/public address but cannot
// relay media, so a call between two peers both behind a restrictive/
// symmetric NAT (common on cellular data) may fail to connect with this
// alone.
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

// Fetches the real iceServers (STUN + TURN relay) from the get-turn-credentials
// Edge Function, which holds the one shared TURN account server-side. Falls
// back to the Google-STUN-only ICE_SERVERS above on any failure so a call can
// still be attempted rather than erroring outright.
export async function fetchIceServers(supabase: SupabaseClient<Database>): Promise<RTCIceServer[]> {
  try {
    const { data, error } = await supabase.functions.invoke<RTCIceServer[]>('get-turn-credentials');
    if (error || !Array.isArray(data) || data.length === 0) return ICE_SERVERS;
    return data;
  } catch {
    return ICE_SERVERS;
  }
}

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
