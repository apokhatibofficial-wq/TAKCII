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
      .then(({ data }) => {
        if (cancelled) return;
        setDriver(data ? rowToCamel<Driver>(data) : null);
        setLoading(false);
      });

    const channel = supabase
      .channel(`driver-profile:${userId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'drivers', filter: `id=eq.${userId}` }, (payload) => {
        setDriver(rowToCamel<Driver>(payload.new as Record<string, unknown>));
      })
      .subscribe();

    return () => {
      cancelled = true;
      channel.unsubscribe();
    };
  }, [userId]);

  return { driver, loading, setDriver };
}
