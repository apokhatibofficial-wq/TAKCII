import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { rowToCamel, type Ad } from '@takc/shared';

// Mirrors the rider app's hook (apps/rider/src/hooks/useActiveAd.ts) —
// newest active ad targeting 'all' or 'drivers', fetched once per Home
// mount. The driver app previously had no ad surface at all.
export function useActiveAd() {
  const [ad, setAd] = useState<Ad | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('ads')
      .select('*')
      .eq('active', true)
      .in('audience', ['all', 'drivers'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setAd(rowToCamel<Ad>(data));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return ad;
}
