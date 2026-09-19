import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Fire-and-forget: an ad impression/click is a nice-to-have stat, never
// something a screen should block on or surface an error for.
export function trackAdImpression(supabase: SupabaseClient<Database>, adId: string): void {
  supabase.rpc('track_ad_impression', { p_ad_id: adId }).then(() => undefined, () => undefined);
}

export function trackAdLinkClick(supabase: SupabaseClient<Database>, adId: string): void {
  supabase.rpc('track_ad_link_click', { p_ad_id: adId }).then(() => undefined, () => undefined);
}
