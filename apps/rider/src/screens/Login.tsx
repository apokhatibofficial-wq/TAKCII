import { useState, type CSSProperties } from 'react';
import { supabase } from '../lib/supabase';

interface LoginProps {
  onSignup: () => void;
  onLoggedIn: () => void;
}

// Ported from index.html's uLoginScreen block — same copy, same layout, same
// gradient card. doLogin resolves "username or phone" to an email via the
// resolve-login-email Edge Function (Supabase Auth only signs in by email),
// then signs in for real.
export default function Login({ onSignup, onLoggedIn }: LoginProps) {
  const [loginId, setLoginId] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [busy, setBusy] = useState(false);

  const doLogin = async () => {
    if (!loginId.trim() || !loginPass) {
      setLoginError('أدخل اسم المستخدم أو رقم الهاتف وكلمة المرور.');
      return;
    }
    setBusy(true);
    setLoginError('');
    try {
      const { data, error } = await supabase.functions.invoke<{ email: string; status: string }>('resolve-login-email', {
        body: { loginId: loginId.trim(), role: 'rider' }
      });
      if (error || !data?.email) {
        setLoginError('لا يوجد حساب بهذا الاسم أو الرقم.');
        return;
      }
      if (data.status !== 'active') {
        setLoginError('هذا الحساب موقوف — راجع الإدارة.');
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: data.email, password: loginPass });
      if (signInError) {
        setLoginError('كلمة المرور غير صحيحة.');
        return;
      }
      onLoggedIn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        overflow: 'auto',
        padding: '30px 24px',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg,#fde403 0%,#fde403 150px,#fff 150px,#fff 100%)'
      }}
    >
      <img src="/assets/logo.png" alt="TAK-C.TAXI" style={{ width: 190, height: 'auto', marginBottom: 8 }} />
      <div style={{ font: "500 13px/1.5 'IBM Plex Sans Arabic',sans-serif", color: '#3f3b34', marginBottom: 22 }}>
        الان في سوريا - إدلب الخضراء
      </div>
      <div
        style={{
          background: '#fff',
          borderRadius: 22,
          padding: '22px 18px 24px',
          boxShadow: '0 10px 30px -18px rgba(24,22,25,.5)',
          border: '1px solid #efe9d8'
        }}
      >
        <div style={{ font: "800 19px/1.35 FreePalestine,Tajawal,sans-serif", marginBottom: 4 }}>تسجيل الدخول</div>
        <div style={{ font: "400 12.5px/1.6 'IBM Plex Sans Arabic',sans-serif", color: '#575757', marginBottom: 18 }}>
          ادخل اسم المستخدم أو رقم الهاتف وكلمة المرور.
        </div>

        <label style={labelStyle}>اسم المستخدم أو رقم الهاتف</label>
        <input
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          placeholder="username أو 09xxxxxxxx"
          style={{ ...inputStyle, marginBottom: 14, direction: 'ltr', textAlign: 'right' }}
        />

        <label style={labelStyle}>كلمة المرور</label>
        <input
          value={loginPass}
          onChange={(e) => setLoginPass(e.target.value)}
          type="password"
          placeholder="••••••"
          style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }}
        />

        {loginError && (
          <div
            style={{
              marginTop: 12,
              background: '#fdecec',
              color: '#b3261e',
              borderRadius: 11,
              padding: '10px 12px',
              font: "600 12px/1.6 'IBM Plex Sans Arabic',sans-serif"
            }}
          >
            {loginError}
          </div>
        )}

        <button onClick={doLogin} disabled={busy} style={{ ...primaryBtnStyle, opacity: busy ? 0.6 : 1 }}>
          {busy ? '...جارٍ الدخول' : 'دخول'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 12px' }}>
          <span style={{ flex: 1, height: 1, background: '#f0ece0' }} />
          <span style={{ font: "500 11.5px/1.35 'IBM Plex Sans Arabic',sans-serif", color: '#9a9a9a' }}>أو</span>
          <span style={{ flex: 1, height: 1, background: '#f0ece0' }} />
        </div>

        <button onClick={onSignup} style={secondaryBtnStyle}>إنشاء حساب جديد</button>
      </div>
    </div>
  );
}

const labelStyle: CSSProperties = {
  display: 'block',
  font: "600 12px/1.35 'IBM Plex Sans Arabic',sans-serif",
  color: '#575757',
  marginBottom: 7
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '13px 14px',
  border: '1.5px solid #e7e1d0',
  borderRadius: 13,
  background: '#faf8f2',
  fontSize: 14
};

const primaryBtnStyle: CSSProperties = {
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

const secondaryBtnStyle: CSSProperties = {
  width: '100%',
  padding: 14,
  border: '1.5px solid #e7e1d0',
  borderRadius: 14,
  background: '#fff',
  color: 'var(--color-black)',
  font: "700 13.5px/1.35 'IBM Plex Sans Arabic',sans-serif",
  cursor: 'pointer'
};
