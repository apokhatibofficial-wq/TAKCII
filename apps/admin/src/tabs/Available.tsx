import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useLang } from '../i18n/LangContext';
import { Button, Card, Toast, useToast } from '../components/ui';
import { rowToCamel, type Driver } from '@takc/shared';

export default function Available() {
  const { t } = useLang();
  const [rows, setRows] = useState<Driver[]>([]);
  const { toastText, toast } = useToast();

  const load = async () => {
    const { data } = await supabase.from('drivers').select('*').eq('status', 'active').eq('online', true);
    if (data) setRows(data.map((r) => rowToCamel<Driver>(r)));
  };
  useEffect(() => {
    load();
    const channel = supabase
      .channel('drivers-available')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => load())
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, []);

  const disconnect = async (d: Driver) => {
    await supabase.from('drivers').update({ online: false }).eq('id', d.id);
    toast('تم فصل السائق');
    load();
  };

  return (
    <div>
      <div style={{ font: "600 12.5px/1.6 'IBM Plex Sans Arabic',sans-serif", color: '#575757', marginBottom: 16 }}>
        {t.tAvailNow} {rows.length}
      </div>
      {rows.length === 0 ? (
        <Card style={{ textAlign: 'center', color: '#8b8b8b' }}>{t.tNoAvail}</Card>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {rows.map((d) => (
            <div key={d.id} style={rowStyle}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--color-green)', flex: 'none' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "700 13.5px/1.3 'IBM Plex Sans Arabic',sans-serif" }}>{d.name}</div>
                <div style={{ font: "400 11.5px/1.4 'IBM Plex Sans Arabic',sans-serif", color: '#575757' }}>
                  {d.car} · {d.lat?.toFixed(4)}, {d.lng?.toFixed(4)}
                </div>
              </div>
              <Button variant="danger" onClick={() => disconnect(d)}>
                {t.tDisconnect}
              </Button>
            </div>
          ))}
        </Card>
      )}
      <Toast text={toastText} />
    </div>
  );
}

const rowStyle = { display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: '1px solid #f0ece0' } as const;
