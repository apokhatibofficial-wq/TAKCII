import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card, Chip, Toast, useToast } from '../components/ui';

interface RatingRow {
  id: string;
  stars: number;
  createdAt: string;
  driverId: string;
  driverName: string;
}

export default function Ratings() {
  const [rows, setRows] = useState<RatingRow[]>([]);
  const [starFilter, setStarFilter] = useState(0);
  const [driverFilter, setDriverFilter] = useState('all');
  const [drivers, setDrivers] = useState<{ id: string; name: string }[]>([]);
  const { toastText, toast } = useToast();

  const load = async () => {
    const { data } = await supabase.from('ratings').select('id,stars,created_at,driver_id,drivers(name)').order('created_at', { ascending: false });
    if (data) {
      setRows(
        data.map((r) => {
          const driverRel = r.drivers as unknown as { name: string } | { name: string }[] | null;
          const driverName = Array.isArray(driverRel) ? driverRel[0]?.name : driverRel?.name;
          return { id: r.id, stars: r.stars, createdAt: r.created_at, driverId: r.driver_id, driverName: driverName ?? '—' };
        })
      );
    }
    const { data: driverRows } = await supabase.from('drivers').select('id,name');
    if (driverRows) setDrivers(driverRows);
  };
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () => rows.filter((r) => (!starFilter || r.stars === starFilter) && (driverFilter === 'all' || r.driverId === driverFilter)),
    [rows, starFilter, driverFilter]
  );
  const avg = rows.length ? (rows.reduce((s, r) => s + r.stars, 0) / rows.length).toFixed(1) : '—';

  const setStars = async (id: string, stars: number) => {
    await supabase.from('ratings').update({ stars, edited_by_admin: true }).eq('id', id);
    toast('تم حفظ التقييم');
    load();
  };
  const remove = async (id: string) => {
    await supabase.from('ratings').delete().eq('id', id);
    toast('تم حذف التقييم');
    load();
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 20, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ font: "800 22px/1.2 FreePalestine,Tajawal,sans-serif" }}>
          {avg} <span style={{ font: "500 12px/1.4 'IBM Plex Sans Arabic',sans-serif", color: '#575757' }}>متوسط التقييم</span>
        </div>
        <div style={{ font: "600 12px/2 'IBM Plex Sans Arabic',sans-serif", color: '#575757' }}>إجمالي التقييمات: {rows.length}</div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {[0, 5, 4, 3, 2, 1].map((n) => (
          <Chip key={n} active={starFilter === n} onClick={() => setStarFilter(n)}>
            {n === 0 ? 'كل النجوم' : '★ ' + n}
          </Chip>
        ))}
      </div>
      <select value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)} style={selectStyle}>
        <option value="all">كل السائقين</option>
        {drivers.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>

      <Card style={{ padding: 0, overflow: 'hidden', marginTop: 14 }}>
        {filtered.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#8b8b8b' }}>لا توجد تقييمات مطابقة</div>}
        {filtered.map((r) => (
          <div key={r.id} style={rowStyle}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: "700 13px/1.3 'IBM Plex Sans Arabic',sans-serif" }}>{r.driverName}</div>
              <div style={{ font: "400 11px/1.4 'IBM Plex Sans Arabic',sans-serif", color: '#9a9a9a' }}>
                {new Date(r.createdAt).toLocaleString('ar')}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 2 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setStars(r.id, n)} style={starBtnStyle(n <= r.stars)}>
                  {n <= r.stars ? '★' : '☆'}
                </button>
              ))}
            </div>
            <button onClick={() => remove(r.id)} style={{ background: 'none', border: 'none', color: '#b3261e', cursor: 'pointer', fontSize: 13 }}>
              حذف
            </button>
          </div>
        ))}
      </Card>
      <Toast text={toastText} />
    </div>
  );
}

const selectStyle = { padding: '9px 12px', border: '1.5px solid #e7e1d0', borderRadius: 11, background: '#faf8f2', fontSize: 13 } as const;
const rowStyle = { display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: '1px solid #f0ece0' } as const;
const starBtnStyle = (filled: boolean) =>
  ({ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: filled ? '#181619' : '#c9c2ac' }) as const;
