import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// URL/key come from each app's own env access (Vite's import.meta.env, Expo's
// process.env) — kept out of this shared package so it stays platform-agnostic.
export function createSupabaseClient(url: string, anonKey: string): SupabaseClient<Database> {
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
}
