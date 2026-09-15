import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useLang } from '../i18n/LangContext';
import { Badge, Button, Card, Input, Toast, useToast } from '../components/ui';
import type { Rider } from '@takc/shared';
import { rowToCamel } from '@takc/shared';

export default function Users() {
  const { t } = useLang();
  const [rows, setRows] = useState<Rider[]>([]);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Rider | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const { toastText, toast } = useToast();

  const load = async () => {
    const { data } = await supabase.from('riders').select('*').order('created_at', { ascending: false });
    if (data) setRows(data.map((r) => rowToCamel<Rider>(r)));
  };
  useEffect(() => {
    load();
  }, []);

  const filtered = rows.filter((r) => !q.trim() || (r.name + r.phone + r.email).includes(q.trim()));

  const toggleStatus = async (r: Rider) => {
    const next = r.status === 'active' ? 'suspended' : 'active';
    await supabase.from('riders').update({ status: next }).eq('id', r.id);
    toast(next === 'active' ? 'تم تفعيل الحساب' : 'تم إيقاف الحساب');
    load();
  };
  const remove = async (r: Rider) => {
    const { error } = await supabase.from('riders').delete().eq('id', r.id);
    if (error) {
      toast(error.code === '23503' ? 'لا يمكن حذف حساب له رحلات أو تقييمات مسجّلة — استخدم إيقاف الحساب بدلاً من ذلك' : 'تعذّر حذف المستخدم');
      return;
    }
    toast('تم حذف المستخدم');
    load();
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} style={{ maxWidth: 320 }} />
        <Button variant="primary" onClick={() => setShowAdd((s) => !s)}>
          {showAdd ? t.close : t.addUser}
        </Button>
      </div>

      {showAdd && <AddUserForm onDone={() => { setShowAdd(false); load(); toast('تم إنشاء حساب المستخدم'); }} />}

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#8b8b8b' }}>لا نتائج</div>}
        {filtered.map((r) => (
          <div key={r.id} style={rowStyle}>
            <div style={avatarStyle}>{(r.name || '؟').slice(0, 1)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: "700 13.5px/1.3 'IBM Plex Sans Arabic',sans-serif" }}>{r.name}</div>
              <div style={{ font: "400 11.5px/1.4 'IBM Plex Sans Arabic',sans-serif", color: '#575757', direction: 'ltr', textAlign: 'right' }}>
                {r.phone} · {r.username}
              </div>
            </div>
            <Badge tone={r.status === 'active' ? 'green' : 'red'}>{r.status === 'active' ? t.stActive : t.stSuspended}</Badge>
            <Button onClick={() => setEditing(r)}>{t.tEdit}</Button>
            <Button variant="ghost" onClick={() => toggleStatus(r)}>
              {r.status === 'active' ? t.stSuspend : t.stResume}
            </Button>
            <Button variant="danger" onClick={() => remove(r)}>
              {t.tDelete}
            </Button>
          </div>
        ))}
      </Card>

      {editing && <EditUserModal user={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); toast('تم حفظ التعديلات'); }} />}
      <Toast text={toastText} />
    </div>
  );
}

function AddUserForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
        body: { role: 'rider', name, phone, email, username, password }
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
      <div style={{ font: "700 13px/1.4 'IBM Plex Sans Arabic',sans-serif", marginBottom: 12 }}>إنشاء حساب مستخدم</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم الكامل" />
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="رقم الهاتف" />
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="البريد الإلكتروني (اختياري)" />
        <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="اسم المستخدم" />
        <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="كلمة المرور" />
      </div>
      {error && <div style={{ marginTop: 10, color: '#b3261e', font: "600 12px/1.5 'IBM Plex Sans Arabic',sans-serif" }}>{error}</div>}
      <Button variant="primary" onClick={save} disabled={busy} style={{ marginTop: 12, opacity: busy ? 0.6 : 1 }}>
        {busy ? '...جارٍ الحفظ' : 'حفظ الحساب'}
      </Button>
    </Card>
  );
}

function EditUserModal({ user, onClose, onSaved }: { user: Rider; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [email, setEmail] = useState(user.email);
  const [username, setUsername] = useState(user.username);

  const save = async () => {
    await supabase.from('riders').update({ name, phone, email, username }).eq('id', user.id);
    onSaved();
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ font: "700 15px/1.4 'IBM Plex Sans Arabic',sans-serif", marginBottom: 14 }}>تعديل الحساب</div>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم" style={{ marginBottom: 10 }} />
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="الهاتف" style={{ marginBottom: 10 }} />
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="البريد" style={{ marginBottom: 10 }} />
        <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="اسم المستخدم" style={{ marginBottom: 14 }} />
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
