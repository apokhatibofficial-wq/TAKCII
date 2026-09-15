import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { rowToCamel, type Ad } from '@takc/shared';

// Ported from index.html's activeAd computation: the newest active ad
// targeting 'all' or this role's audience. Fetched once per Home mount
// (i.e. once per login), matching the prototype showing it fresh on login.
export function useActiveAd() {
  const [ad, setAd] = useState<Ad | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('ads')
      .select('*')
      .eq('active', true)
      .in('audience', ['all', 'users'])
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
