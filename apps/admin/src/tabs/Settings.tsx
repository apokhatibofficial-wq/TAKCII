import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useLang } from '../i18n/LangContext';
import { Button, Card, Input, Toast, useToast } from '../components/ui';

export default function Settings() {
  const { t } = useLang();
  const [username, setUsername] = useState('');
  const [newPass, setNewPass] = useState('');
  const { toastText, toast } = useToast();

  useEffect(() => {
    supabase
      .from('admin_users')
      .select('username')
      .then(({ data }) => {
        if (data?.[0]) setUsername(data[0].username);
      });
  }, []);

  const save = async () => {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;
    if (username.trim()) {
      await supabase.from('admin_users').update({ username: username.trim() }).eq('id', user.id);
    }
    if (newPass) {
      if (newPass.length < 6) {
        toast('كلمة المرور يجب أن تكون 6 محارف على الأقل');
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) {
        toast('تعذّر تغيير كلمة المرور');
        return;
      }
    }
    setNewPass('');
    toast('تم حفظ بيانات الدخول');
  };

  return (
    <div>
      <Card style={{ marginBottom: 16, maxWidth: 420 }}>
        <div style={{ font: "700 13px/1.4 'IBM Plex Sans Arabic',sans-serif", marginBottom: 12 }}>{t.tAdminAcc}</div>
        <label style={labelStyle}>{t.tUsername}</label>
        <Input value={username} onChange={(e) => setUsername(e.target.value)} style={{ marginBottom: 12 }} />
        <label style={labelStyle}>{t.tNewPass}</label>
        <Input value={newPass} onChange={(e) => setNewPass(e.target.value)} type="password" placeholder="اتركها فارغة لعدم التغيير" style={{ marginBottom: 14 }} />
        <Button variant="primary" onClick={save}>
          {t.tSaveChanges}
        </Button>
      </Card>

      <Card style={{ maxWidth: 420 }}>
        <div style={{ font: "700 13px/1.4 'IBM Plex Sans Arabic',sans-serif", marginBottom: 10 }}>النظام</div>
        <Row label={t.tVersion} value="1.0.0" />
        <Row label="الباك-إند" value="Supabase (Postgres + Auth + Realtime)" />
        <Row label="تخزين البيانات" value="قاعدة بيانات حقيقية، لا localStorage" />
      </Card>
      <Toast text={toastText} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', font: "500 12.5px/1.5 'IBM Plex Sans Arabic',sans-serif" }}>
      <span style={{ color: '#575757' }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

const labelStyle = { display: 'block', font: "600 12px/1.35 'IBM Plex Sans Arabic',sans-serif", color: '#575757', marginBottom: 7 } as const;
