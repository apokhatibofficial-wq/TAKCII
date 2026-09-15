import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useLang } from '../i18n/LangContext';
import { Badge, Button, Card, Input, Toast, useToast } from '../components/ui';
import { rowToCamel, type Driver } from '@takc/shared';

export default function Drivers() {
  const { t } = useLang();
  const [rows, setRows] = useState<Driver[]>([]);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Driver | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const { toastText, toast } = useToast();

  const load = async () => {
    const { data } = await supabase.from('drivers').select('*').order('updated_at', { ascending: false });
    if (data) setRows(data.map((r) => rowToCamel<Driver>(r)));
  };
  useEffect(() => {
    load();
  }, []);

  const filtered = rows.filter((r) => !q.trim() || (r.name + r.phone + r.plate).includes(q.trim()));

  const approve = async (d: Driver) => {
    await supabase.from('drivers').update({ status: 'active', online: true }).eq('id', d.id);
    toast('تم تفعيل حساب السائق');
    load();
  };
  const toggleSuspend = async (d: Driver) => {
    const next = d.status === 'suspended' ? 'active' : 'suspended';
    await supabase.from('drivers').update({ status: next, online: false }).eq('id', d.id);
    toast('تم تحديث حالة السائق');
    load();
  };
  const remove = async (d: Driver) => {
    const { error } = await supabase.from('drivers').delete().eq('id', d.id);
    if (error) {
      toast(error.code === '23503' ? 'لا يمكن حذف حساب له رحلات أو تقييمات مسجّلة — استخدم إيقاف الحساب بدلاً من ذلك' : 'تعذّر حذف السائق');
      return;
    }
    toast('تم حذف السائق');
    load();
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} style={{ maxWidth: 320 }} />
        <Button variant="primary" onClick={() => setShowAdd((s) => !s)}>
          {showAdd ? t.close : t.addDriver}
        </Button>
      </div>

      {showAdd && <AddDriverForm onDone={() => { setShowAdd(false); load(); toast('تم إنشاء حساب السائق'); }} />}

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#8b8b8b' }}>لا نتائج</div>}
        {filtered.map((d) => {
          const total = d.acceptedCount + d.rejectedCount;
          const rate = total > 0 ? Math.round((d.acceptedCount * 100) / total) + '%' : '—';
          return (
            <div key={d.id} style={rowStyle}>
              <div style={avatarStyle}>{(d.name || '؟').slice(0, 1)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "700 13.5px/1.3 'IBM Plex Sans Arabic',sans-serif" }}>{d.name}</div>
                <div style={{ font: "400 11.5px/1.4 'IBM Plex Sans Arabic',sans-serif", color: '#575757' }}>
                  {d.car} · <span style={{ direction: 'ltr', display: 'inline-block' }}>{d.plate}</span>
                </div>
              </div>
              <div style={{ font: "600 11px/1.3 'IBM Plex Sans Arabic',sans-serif", color: '#575757', textAlign: 'center' }}>
                {t.tRate}
                <br />
                {rate}
              </div>
              <Badge tone={d.status === 'active' ? (d.online ? 'green' : 'gray') : d.status === 'pending' ? 'yellow' : 'red'}>
                {d.status === 'active' ? (d.online ? t.stOnline : t.stActive) : d.status === 'pending' ? t.stPending : t.stSuspended}
              </Badge>
              {d.status === 'pending' && (
                <Button variant="primary" onClick={() => approve(d)}>
                  {t.stApprove}
                </Button>
              )}
              <Button onClick={() => setEditing(d)}>{t.tEdit}</Button>
              {d.status !== 'pending' && (
                <Button variant="ghost" onClick={() => toggleSuspend(d)}>
                  {d.status === 'suspended' ? t.stResume : t.stSuspend}
                </Button>
              )}
              <Button variant="danger" onClick={() => remove(d)}>
                {t.tDelete}
              </Button>
            </div>
          );
        })}
      </Card>

      {editing && (
        <EditDriverModal driver={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); toast('تم حفظ التعديلات'); }} />
      )}
      <Toast text={toastText} />
    </div>
  );
}

function AddDriverForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [plate, setPlate] = useState('');
  const [car, setCar] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim() || !phone.trim() || !username.trim() || !password) {
      setError('الاسم والهاتف واسم المستخدم وكلمة المرور مطلوبة (6 محارف على الأقل)');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { error: fnError } = await supabase.functions.invoke('admin-create-account', {
        body: { role: 'driver', name, phone, email, username, password, plate, car }
      });
      if (fnError) {
        setError('تعذّر إنشاء الحساب — تأكد أن اسم المستخدم غير محجوز.');
        return;
      }
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ font: "700 13px/1.4 'IBM Plex Sans Arabic',sans-serif", marginBottom: 4 }}>إنشاء حساب سائق مفعّل مباشرة</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, marginTop: 10 }}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم الكامل" />
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="رقم الهاتف" />
        <Input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="رقم اللوحة" />
        <Input value={car} onChange={(e) => setCar(e.target.value)} placeholder="نوع السيارة" />
        <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="اسم المستخدم" />
        <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="كلمة المرور" />
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="البريد (اختياري)" />
      </div>
      {error && <div style={{ marginTop: 10, color: '#b3261e', font: "600 12px/1.5 'IBM Plex Sans Arabic',sans-serif" }}>{error}</div>}
      <Button variant="primary" onClick={save} disabled={busy} style={{ marginTop: 12, opacity: busy ? 0.6 : 1 }}>
        {busy ? '...جارٍ الحفظ' : 'حفظ الحساب'}
      </Button>
    </Card>
  );
}

function EditDriverModal({ driver, onClose, onSaved }: { driver: Driver; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(driver.name);
  const [phone, setPhone] = useState(driver.phone);
  const [plate, setPlate] = useState(driver.plate);
  const [car, setCar] = useState(driver.car);

  const save = async () => {
    await supabase.from('drivers').update({ name, phone, plate, car }).eq('id', driver.id);
    onSaved();
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ font: "700 15px/1.4 'IBM Plex Sans Arabic',sans-serif", marginBottom: 14 }}>تعديل حساب السائق</div>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم" style={{ marginBottom: 10 }} />
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="الهاتف" style={{ marginBottom: 10 }} />
        <Input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="اللوحة" style={{ marginBottom: 10 }} />
        <Input value={car} onChange={(e) => setCar(e.target.value)} placeholder="نوع السيارة" style={{ marginBottom: 14 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="primary" onClick={save} style={{ flex: 1 }}>
            حفظ التعديلات
          </Button>
          <Button onClick={onClose} style={{ flex: 1 }}>
            إلغاء
          </Button>
        </div>
      </div>
    </div>
  );
}

const rowStyle = { display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: '1px solid #f0ece0' } as const;
const avatarStyle = {
  width: 38,
  height: 38,
  borderRadius: 12,
  background: 'var(--color-cream)',
  display: 'grid',
  placeItems: 'center',
  font: "800 14px/1.35 'IBM Plex Sans Arabic',sans-serif",
  flex: 'none'
} as const;
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(24,22,25,.45)', display: 'grid', placeItems: 'center', zIndex: 100, padding: 20 } as const;
const modalStyle = { background: '#fff', borderRadius: 18, padding: 22, width: '100%', maxWidth: 380 } as const;
