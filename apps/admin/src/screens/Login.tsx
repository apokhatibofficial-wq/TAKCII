import { useState, type CSSProperties } from 'react';
import { supabase } from '../lib/supabase';

export default function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const doLogin = async () => {
    if (!username.trim() || !password) {
      setError('أدخل اسم المستخدم وكلمة المرور.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { data, error: fnError } = await supabase.functions.invoke<{ email: string }>('resolve-login-email', {
        body: { loginId: username.trim(), role: 'admin' }
      });
      if (fnError || !data?.email) {
        setError('لا يوجد حساب أدمن بهذا الاسم.');
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: data.email, password });
      if (signInError) {
        setError('كلمة المرور غير صحيحة.');
        return;
      }
      onLoggedIn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={wrapStyle}>
      <div style={cardStyle}>
        <img src="/assets/logo.png" alt="TAK-C.TAXI" style={{ width: 150, height: 'auto', margin: '0 auto 18px', display: 'block' }} />
        <div style={{ font: "800 20px/1.3 'IBM Plex Sans Arabic',sans-serif", textAlign: 'center', marginBottom: 4 }}>لوحة التحكم</div>
        <div style={{ font: "400 12.5px/1.6 'IBM Plex Sans Arabic',sans-serif", color: '#575757', textAlign: 'center', marginBottom: 22 }}>
          دخول الأدمن
        </div>
        <label style={labelStyle}>اسم المستخدم</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" style={{ ...inputStyle, marginBottom: 14 }} />
        <label style={labelStyle}>كلمة المرور</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••" style={inputStyle} />
        {error && <div style={errorStyle}>{error}</div>}
        <button onClick={doLogin} disabled={busy} style={{ ...btnStyle, opacity: busy ? 0.6 : 1 }}>
          {busy ? '...جارٍ الدخول' : 'دخول'}
        </button>
      </div>
    </div>
  );
}

const wrapStyle: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--color-cream)',
  padding: 20
};
const cardStyle: CSSProperties = {
  width: '100%',
  maxWidth: 360,
  background: '#fff',
  borderRadius: 22,
  padding: '30px 26px',
  boxShadow: '0 20px 50px -24px rgba(24,22,25,.4)',
  border: '1px solid #efe9d8'
};
const labelStyle: CSSProperties = { display: 'block', font: "600 12px/1.35 'IBM Plex Sans Arabic',sans-serif", color: '#575757', marginBottom: 7 };
const inputStyle: CSSProperties = {
  width: '100%',
  padding: '13px 14px',
  border: '1.5px solid #e7e1d0',
  borderRadius: 13,
  background: '#faf8f2',
  fontSize: 14,
  direction: 'ltr',
  textAlign: 'right'
};
const errorStyle: CSSProperties = {
  marginTop: 12,
  background: '#fdecec',
  color: '#b3261e',
  borderRadius: 11,
  padding: '10px 12px',
  font: "600 12px/1.6 'IBM Plex Sans Arabic',sans-serif"
};
const btnStyle: CSSProperties = {
  width: '100%',
  marginTop: 18,
  padding: 15,
  border: 'none',
  borderRadius: 14,
  background: 'var(--color-black)',
  color: 'var(--color-yellow)',
  font: "800 15px/1.35 Tajawal,sans-serif",
  cursor: 'pointer'
};
