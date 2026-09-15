// Fare math — ported 1:1 from the prototype's fareOf/fmtMoney (index.html).
import type { CurrencyCode, PricingRow } from './types';

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  SYP: 'ل.س',
  TRY: '₺',
  USD: '$'
};

export const CURRENCY_LABELS: Record<CurrencyCode, { ar: string; en: string }> = {
  SYP: { ar: 'ليرة سورية جديدة', en: 'New Syrian Lira' },
  TRY: { ar: 'ليرة تركية', en: 'Turkish Lira' },
  USD: { ar: 'دولار أمريكي', en: 'US Dollar' }
};

export function fareOf(pricing: PricingRow, km: number, minutes: number): number {
  const raw = pricing.base + pricing.perKm * km + pricing.perMin * minutes;
  const val = Math.max(pricing.minFare, raw);
  const step = pricing.roundTo || 1;
  return Math.round(val / step) * step;
}

export function fmtMoney(currency: CurrencyCode, value: number): string {
  const symbol = CURRENCY_SYMBOLS[currency];
  const n = value >= 100 ? Math.round(value) : Math.round(value * 100) / 100;
  return `${n.toLocaleString('en-US')} ${symbol}`;
}

export function waitFareOf(pricing: PricingRow, waitSeconds: number): number {
  return (waitSeconds / 3600) * pricing.perWaitHour;
}
