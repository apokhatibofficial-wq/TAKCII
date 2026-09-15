import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface DriverStats {
  tripsToday: number;
  avgRating: string;
}

// Trip count + rating average, queried the same way the admin's Drivers/Ratings
// tabs do it (client-side average over this driver's ratings rows). Acceptance
// rate is derived from drivers.accepted_count/rejected_count directly by the
// caller, same as admin's Drivers tab — no query needed for that one.
export function useDriverStats(driverId: string | null) {
  const [stats, setStats] = useState<DriverStats>({ tripsToday: 0, avgRating: '—' });

  useEffect(() => {
    if (!driverId) return;
    let cancelled = false;
    (async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const [{ count }, { data: ratings }] = await Promise.all([
        supabase
          .from('rides')
          .select('id', { count: 'exact', head: true })
          .eq('driver_id', driverId)
          .eq('status', 'done')
          .gte('completed_at', startOfDay.toISOString()),
        supabase.from('ratings').select('stars').eq('driver_id', driverId)
      ]);
      if (cancelled) return;
      const avg = ratings && ratings.length ? (ratings.reduce((s, r) => s + r.stars, 0) / ratings.length).toFixed(1) : '—';
      setStats({ tripsToday: count ?? 0, avgRating: avg });
    })();
    return () => {
      cancelled = true;
    };
  }, [driverId]);

  return stats;
}
