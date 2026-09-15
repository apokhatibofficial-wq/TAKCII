import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { rowToCamel, type PricingRow, type PricingSettings } from '@takc/shared';

export function useFare() {
  const [pricing, setPricing] = useState<PricingRow | null>(null);
  const [settings, setSettings] = useState<PricingSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: settingsRow } = await supabase.from('pricing_settings').select('*').eq('id', true).maybeSingle();
      if (cancelled || !settingsRow) return;
      const s = rowToCamel<PricingSettings>(settingsRow);
      setSettings(s);
      const { data: pricingRow } = await supabase.from('pricing').select('*').eq('currency', s.activeCurrency).maybeSingle();
      if (!cancelled && pricingRow) setPricing(rowToCamel<PricingRow>(pricingRow));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { pricing, settings };
}
