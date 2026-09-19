import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fmtMoney, type CurrencyCode } from '@takc/shared';
import { Card, Chip } from '../components/ui';

interface SaleRide {
  id: string;
  driverId: string | null;
  driverName: string;
  fareAmount: number;
  waitFare: number;
  total: number;
  currency: CurrencyCode;
  pickupName: string;
  destName: string;
  completedAt: string;
}

type Period = 'today' | 'week' | 'month' | 'all';
type SortDir = 'desc' | 'asc';

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}
// Browser-local calendar date (YYYY-MM-DD) — completed_at comes back as a UTC
// timestamp, and slicing that string directly would put late-night rides on
// the wrong day for anyone east of UTC. en-CA formats as ISO order, so this
// matches the value <input type="date"> produces.
function localDateKey(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA');
}

const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'اليوم' },
  { id: 'week', label: 'آخر 7 أيام' },
  { id: 'month', label: 'هذا الشهر' },
  { id: 'all', label: 'كل الفترات' }
];

export default function Sales() {
  const [rides, setRides] = useState<SaleRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('today');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [reportDate, setReportDate] = useState(() => localDateKey(new Date().toISOString()));

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('rides')
        .select('id,driver_id,fare_amount,fare_currency,wait_fare,pickup_name,dest_name,completed_at,drivers(name)')
        .eq('status', 'done')
        .order('completed_at', { ascending: false });
      if (data) {
        // completed_at is nullable in the schema even though every ride this
        // screen cares about is status='done' -- a handful of old rows from
        // early testing predate that column being set reliably. Skip them:
        // there's no date to bucket them under, so counting them anywhere
        // would either crash or silently show up under the Unix epoch.
        setRides(
          data.flatMap((r) => {
            if (!r.completed_at) return [];
            const driverRel = r.drivers as unknown as { name: string } | { name: string }[] | null;
            const driverName = Array.isArray(driverRel) ? driverRel[0]?.name : driverRel?.name;
            const fareAmount = r.fare_amount ?? 0;
            const waitFare = r.wait_fare ?? 0;
            return [
              {
                id: r.id,
                driverId: r.driver_id,
                driverName: driverName ?? '—',
                fareAmount,
                waitFare,
                total: fareAmount + waitFare,
                currency: (r.fare_currency ?? 'SYP') as CurrencyCode,
                pickupName: r.pickup_name,
                destName: r.dest_name,
                completedAt: r.completed_at
              }
            ];
          })
        );
      }
      setLoading(false);
    })();
  }, []);

  // The platform runs a single active currency at a time (see Pricing tab) —
  // this picks whichever currency actually shows up most in the data, so a
  // past currency switch can't silently add SYP and USD into one number.
  const mainCurrency = useMemo<CurrencyCode>(() => {
    const counts = new Map<CurrencyCode, number>();
    rides.forEach((r) => counts.set(r.currency, (counts.get(r.currency) ?? 0) + 1));
    let best: CurrencyCode = 'SYP';
    let bestCount = -1;
    counts.forEach((count, cur) => {
      if (count > bestCount) {
        best = cur;
        bestCount = count;
      }
    });
    return best;
  }, [rides]);

  const periodStart = useMemo(() => {
    if (period === 'today') return startOfToday();
    if (period === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return d;
    }
    if (period === 'month') return startOfMonth();
    return null;
  }, [period]);

  const periodRides = useMemo(
    () => rides.filter((r) => r.currency === mainCurrency && (!periodStart || new Date(r.completedAt) >= periodStart)),
    [rides, mainCurrency, periodStart]
  );

  const totalRevenue = periodRides.reduce((s, r) => s + r.total, 0);
  const avgFare = periodRides.length ? totalRevenue / periodRides.length : 0;

  const leaderboard = useMemo(() => {
    const byDriver = new Map<string, { driverId: string; driverName: string; count: number; total: number }>();
    periodRides.forEach((r) => {
      if (!r.driverId) return;
      const row = byDriver.get(r.driverId) ?? { driverId: r.driverId, driverName: r.driverName, count: 0, total: 0 };
      row.count += 1;
      row.total += r.total;
      byDriver.set(r.driverId, row);
    });
    const list = Array.from(byDriver.values());
    list.sort((a, b) => (sortDir === 'desc' ? b.total - a.total : a.total - b.total));
    return list;
  }, [periodRides, sortDir]);

  const dayRides = useMemo(() => rides.filter((r) => localDateKey(r.completedAt) === reportDate), [rides, reportDate]);
  const dayTotalsByCurrency = useMemo(() => {
    const m = new Map<CurrencyCode, number>();
    dayRides.forEach((r) => m.set(r.currency, (m.get(r.currency) ?? 0) + r.total));
    return m;
  }, [dayRides]);

  const downloadCsv = () => {
    const header = ['الوقت', 'السائق', 'من', 'إلى', 'الأجرة', 'الانتظار', 'الإجمالي', 'العملة'];
    const lines = dayRides.map((r) => [
      new Date(r.completedAt).toLocaleTimeString('ar'),
      r.driverName,
      r.pickupName,
      r.destName,
      r.fareAmount.toString(),
      r.waitFare.toString(),
      r.total.toString(),
      r.currency
    ]);
    const csv = [header, ...lines].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `فواتير-${reportDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return null;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {PERIODS.map((p) => (
          <Chip key={p.id} active={period === p.id} onClick={() => setPeriod(p.id)}>
            {p.label}
          </Chip>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="عدد الرحلات المكتملة" value={periodRides.length.toLocaleString('en-US')} />
        <StatCard label="إجمالي الأرباح" value={fmtMoney(mainCurrency, totalRevenue)} accent />
        <StatCard label="متوسط الرحلة" value={fmtMoney(mainCurrency, avgFare)} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ font: "700 14px/1.4 'IBM Plex Sans Arabic',sans-serif" }}>سجل السائقين والمبالغ</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Chip active={sortDir === 'desc'} onClick={() => setSortDir('desc')}>
            الأعلى دخلاً
          </Chip>
          <Chip active={sortDir === 'asc'} onClick={() => setSortDir('asc')}>
            الأقل دخلاً
          </Chip>
        </div>
      </div>

      <Card style={{ padding: 0, overflow: 'hidden', marginBottom: 28 }}>
        {leaderboard.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#8b8b8b' }}>لا توجد رحلات مكتملة في هذه الفترة</div>}
        {leaderboard.map((d, i) => (
          <div key={d.driverId} style={rowStyle}>
            <div style={rankStyle}>{i + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: "700 13px/1.3 'IBM Plex Sans Arabic',sans-serif" }}>{d.driverName}</div>
              <div style={{ font: "400 11px/1.4 'IBM Plex Sans Arabic',sans-serif", color: '#9a9a9a' }}>{d.count} رحلة</div>
            </div>
            <div style={{ font: "800 13.5px/1.3 'IBM Plex Sans Arabic',sans-serif", color: '#181619' }}>{fmtMoney(mainCurrency, d.total)}</div>
          </div>
        ))}
      </Card>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <div style={{ font: "700 14px/1.4 'IBM Plex Sans Arabic',sans-serif" }}>التقرير اليومي للفواتير</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} style={dateInputStyle} />
            <Chip active={false} onClick={downloadCsv}>
              تنزيل CSV
            </Chip>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{ font: "600 12.5px/1.6 'IBM Plex Sans Arabic',sans-serif", color: '#575757' }}>عدد الفواتير: {dayRides.length}</div>
          {Array.from(dayTotalsByCurrency.entries()).map(([cur, total]) => (
            <div key={cur} style={{ font: "700 12.5px/1.6 'IBM Plex Sans Arabic',sans-serif", color: '#181619' }}>
              إجمالي {cur}: {fmtMoney(cur, total)}
            </div>
          ))}
        </div>

        <div style={{ border: '1px solid #ece6d6', borderRadius: 13, overflow: 'hidden' }}>
          {dayRides.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: '#8b8b8b' }}>لا توجد فواتير في هذا اليوم</div>}
          {dayRides.map((r) => (
            <div key={r.id} style={invoiceRowStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "700 12.5px/1.3 'IBM Plex Sans Arabic',sans-serif" }}>{r.driverName}</div>
                <div style={{ font: "400 11px/1.5 'IBM Plex Sans Arabic',sans-serif", color: '#9a9a9a' }}>
                  {r.pickupName} ← {r.destName}
                </div>
              </div>
              <div style={{ font: "500 11px/1.4 'IBM Plex Sans Arabic',sans-serif", color: '#9a9a9a' }}>
                {new Date(r.completedAt).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div style={{ font: "800 13px/1.3 'IBM Plex Sans Arabic',sans-serif", color: '#181619', minWidth: 90, textAlign: 'left' }}>
                {fmtMoney(r.currency, r.total)}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card style={accent ? { background: 'var(--color-black)' } : undefined}>
      <div style={{ font: "800 22px/1.2 FreePalestine,Tajawal,sans-serif", color: accent ? 'var(--color-yellow)' : '#181619' }}>{value}</div>
      <div style={{ font: "500 12px/1.4 'IBM Plex Sans Arabic',sans-serif", color: accent ? 'rgba(244,239,225,.75)' : '#575757', marginTop: 4 }}>
        {label}
      </div>
    </Card>
  );
}

const rowStyle = { display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: '1px solid #f0ece0' } as const;
const invoiceRowStyle = { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid #f0ece0' } as const;
const rankStyle = {
  width: 22,
  height: 22,
  borderRadius: 7,
  background: '#eef0ea',
  color: '#575757',
  display: 'grid',
  placeItems: 'center',
  font: "700 11px/1 'IBM Plex Sans Arabic',sans-serif",
  flex: 'none'
} as const;
const dateInputStyle = { padding: '8px 12px', border: '1.5px solid #e7e1d0', borderRadius: 11, background: '#faf8f2', fontSize: 12.5 } as const;
