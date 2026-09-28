import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Fire-and-forget: call right after a ride-mutating RPC (request_ride,
// accept_ride, reject_ride, advance_trip, cancel_ride) succeeds. The Edge
// Function re-reads the ride itself to decide who gets notified, so a
// missed or duplicate call here never sends a wrong notification — worst
// case is just a skipped or slightly redundant one.
export function notifyRideChange(supabase: SupabaseClient<Database>, rideId: string): void {
  supabase.functions.invoke('send-ride-notification', { body: { rideId } }).catch(() => undefined);
}

// Same fire-and-forget pattern, for the other party's push notification
// after send_ride_message() succeeds -- the Edge Function re-reads the
// message itself to decide who gets notified, saying what.
export function notifyNewMessage(supabase: SupabaseClient<Database>, messageId: string): void {
  supabase.functions.invoke('send-message-notification', { body: { messageId } }).catch(() => undefined);
}
