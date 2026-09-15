import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CURRENCY_LABELS, rowToCamel, type CurrencyCode, type PricingRow, type PricingSettings } from '@takc/shared';
import { useLang } from '../i18n/LangContext';
import { Button, Card, Chip, Input, Toast, useToast } from '../components/ui';

const CURRENCIES: CurrencyCode[] = ['SYP', 'TRY', 'USD'];

export default function Pricing() {
  const { lang } = useLang();
  const [settings, setSettings] = useState<PricingSettings | null>(null);
  const [byCurrency, setByCurrency] = useState<Record<CurrencyCode, PricingRow>>({} as Record<CurrencyCode, PricingRow>);
  const [draftCurrency, setDraftCurrency] = useState<CurrencyCode>('SYP');
  const [draft, setDraft] = useState<PricingRow | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toastText, toast } = useToast();

  const load = async () => {
    const { data: settingsRow } = await supabase.from('pricing_settings').select('*').eq('id', true).maybeSingle();
    if (settingsRow) setSettings(rowToCamel<PricingSettings>(settingsRow));
    const { data: pricingRows } = await supabase.from('pricing').select('*');
    if (pricingRows) {
      const map = {} as Record<CurrencyCode, PricingRow>;
      pricingRows.forEach((r) => {
        const camel = rowToCamel<PricingRow>(r);
        map[camel.currency] = camel;
      });
      setByCurrency(map);
      const cur = settingsRow ? rowToCamel<PricingSettings>(settingsRow).activeCurrency : 'SYP';
      setDraftCurrency(cur);
      if (map[cur]) setDraft(map[cur]);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const pickCurrency = (c: CurrencyCode) => {
    setDraftCurrency(c);
    setDraft(byCurrency[c] ?? null);
  };

  const dirty =
    draft &&
    settings &&
    (draftCurrency !== settings.activeCurrency ||
      byCurrency[draftCurrency] == null ||
      JSON.stringify(draft) !== JSON.stringify(byCurrency[draftCurrency]));

  const save = async () => {
    if (!draft) return;
    await supabase
      .from('pricing')
      .update({
        base: draft.base,
        per_km: draft.perKm,
        per_min: draft.perMin,
        min_fare: draft.minFare,
        round_to: draft.roundTo,
        per_wait_hour: draft.perWaitHour
      })
      .eq('currency', draftCurrency);
    await supabase.from('pricing_settings').update({ active_currency: draftCurrency }).eq('id', true);
    setConfirmOpen(false);
    toast(lang === 'en' ? 'Pricing updated' : 'تم تحديث التسعيرة');
    load();
  };

  const toggleVisible = async () => {
    if (!settings) return;
    await supabase.from('pricing_settings').update({ show_to_riders: !settings.showToRiders }).eq('id', true);
    load();
  };

  if (!draft) return null;
  const symbol = CURRENCY_LABELS[draftCurrency];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ font: "700 13px/1.4 'IBM Plex Sans Arabic',sans-serif", marginBottom: 10 }}>العملة</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          {CURRENCIES.map((c) => (
            <Chip key={c} active={draftCurrency === c} onClick={() => pickCurrency(c)}>
              {lang === 'en' ? CURRENCY_LABELS[c].en : CURRENCY_LABELS[c].ar}
            </Chip>
          ))}
        </div>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ font: "700 13px/1.4 'IBM Plex Sans Arabic',sans-serif", marginBottom: 12 }}>
          الأجرة = أساس + (الكيلومتر × سعره) + (الدقيقة × سعرها)، بحد أدنى وتقريب — لكل عملة قيمها المستقلة.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
          <Field label={`السعر الأساسي (${symbol[lang]})`} value={draft.base} onChange={(v) => setDraft({ ...draft, base: v })} />
          <Field label={`سعر الكيلومتر (${symbol[lang]})`} value={draft.perKm} onChange={(v) => setDraft({ ...draft, perKm: v })} />
          <Field label={`سعر الدقيقة (${symbol[lang]})`} value={draft.perMin} onChange={(v) => setDraft({ ...draft, perMin: v })} />
          <Field label={`الحد الأدنى (${symbol[lang]})`} value={draft.minFare} onChange={(v) => setDraft({ ...draft, minFare: v })} />
          <Field label="التقريب لأقرب" value={draft.roundTo} onChange={(v) => setDraft({ ...draft, roundTo: v })} />
          <Field label={`سعر ساعة الانتظار (${symbol[lang]})`} value={draft.perWaitHour} onChange={(v) => setDraft({ ...draft, perWaitHour: v })} />
        </div>
        <Button variant="primary" disabled={!dirty} onClick={() => setConfirmOpen(true)} style={{ marginTop: 16, opacity: dirty ? 1 : 0.5 }}>
          حفظ التسعيرة
        </Button>
      </Card>

      {settings && (
        <Card style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ font: "700 13px/1.4 'IBM Plex Sans Arabic',sans-serif" }}>إظهار التسعيرة للمستخدمين</div>
            <div style={{ font: "400 12px/1.6 'IBM Plex Sans Arabic',sans-serif", color: '#575757' }}>
              {settings.showToRiders ? 'يرى الراكب السعر التقريبي قبل الطلب.' : 'السعر مخفي عن الراكب والسائق — يبقى محسوباً داخلياً.'}
            </div>
          </div>
          <Button onClick={toggleVisible}>{settings.showToRiders ? 'إخفاء' : 'إظهار'}</Button>
        </Card>
      )}

      {confirmOpen && (
        <div style={overlayStyle} onClick={() => setConfirmOpen(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ font: "700 15px/1.4 'IBM Plex Sans Arabic',sans-serif", marginBottom: 10 }}>تغيير التسعيرة؟</div>
            <div style={{ font: "400 13px/1.7 'IBM Plex Sans Arabic',sans-serif", color: '#575757', marginBottom: 16 }}>
              سيتم تغيير التسعيرة والعملة لكل المستخدمين والسائقين فوراً.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="primary" onClick={save} style={{ flex: 1 }}>
                أوافق
              </Button>
              <Button onClick={() => setConfirmOpen(false)} style={{ flex: 1 }}>
                إلغاء
              </Button>
            </div>
          </div>
        </div>
      )}
      <Toast text={toastText} />
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label style={{ display: 'block', font: "600 11.5px/1.35 'IBM Plex Sans Arabic',sans-serif", color: '#575757', marginBottom: 6 }}>
        {label}
      </label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
        style={{ direction: 'ltr', textAlign: 'right' }}
      />
    </div>
  );
}

const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(24,22,25,.45)', display: 'grid', placeItems: 'center', zIndex: 100, padding: 20 } as const;
const modalStyle = { background: '#fff', borderRadius: 18, padding: 22, width: '100%', maxWidth: 380 } as const;
