import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { rowToCamel, type Driver } from '@takc/shared';

// Realtime-backed so an admin suspending/approving/force-disconnecting this
// driver from the dashboard (Available/Drivers tabs) is reflected live,
// matching the prototype's editUser/offline admin actions kicking the
// currently-logged-in driver's own screen back to login or idle.
export function useDriverProfile(userId: string | null) {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setDriver(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from('drivers')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
      .then(
        ({ data }) => {
          if (cancelled) return;
          setDriver(data ? rowToCamel<Driver>(data) : null);
          setLoading(false);
        },
        () => {
          // A rejected promise here (rather than an {error} field) previously
          // left loading stuck at true forever with no feedback at all.
          if (cancelled) return;
          setDriver(null);
          setLoading(false);
        }
      );

    // Realtime setup wrapped defensively: it runs immediately after every
    // login, before the app ever reaches Home, and nothing upstream of this
    // hook could catch it if it threw — a bad channel/WebSocket failure here
    // would have looked exactly like "briefly loads then back to login,"
    // indistinguishable from an auth problem.
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`driver-profile:${userId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'drivers', filter: `id=eq.${userId}` }, (payload) => {
          setDriver(rowToCamel<Driver>(payload.new as Record<string, unknown>));
        })
        .subscribe();
    } catch {
      channel = null;
    }

    return () => {
      cancelled = true;
      try {
        channel?.unsubscribe();
      } catch {
        // ignore
      }
    };
  }, [userId]);

  return { driver, loading, setDriver };
}
