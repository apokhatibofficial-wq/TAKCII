import { useState, type CSSProperties } from 'react';
import { supabase } from '../lib/supabase';

export interface SignupPayload {
  name: string;
  phone: string;
  email: string;
  username: string;
}

interface SignupProps {
  onSent: (payload: SignupPayload) => void;
  onLogin: () => void;
}

// Ported from index.html's uAuthForm block. sendOtp now really creates the
// Supabase Auth user (unconfirmed) and triggers its "Confirm signup" email —
// see النشر.md's Stage 2 note for the SMTP/template setup this depends on.
export default function Signup({ onSent, onLogin }: SignupProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const sendOtp = async () => {
    if (!name.trim() || !phone.trim() || !email.trim() || !username.trim() || !password) {
      setError('عبّئ كل الحقول قبل المتابعة.');
      return;
    }
    setSending(true);
    setError('');
    try {
      const { data: taken, error: rpcError } = await supabase.rpc('is_username_taken', { candidate: username.trim() });
      if (rpcError) {
        setError('تعذّر التحقق من اسم المستخدم، حاول لاحقاً.');
        return;
      }
      if (taken) {
        setError('اسم المستخدم محجوز — اختر اسماً آخر.');
        return;
      }
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { name: name.trim(), phone: phone.trim(), username: username.trim() } }
      });
      if (signUpError) {
        setError(
          signUpError.message.includes('registered') ? 'هذا البريد مسجّل مسبقاً.' : 'تعذّر إرسال رمز التحقق، حاول لاحقاً.'
        );
        return;
      }
      onSent({ name: name.trim(), phone: phone.trim(), email: email.trim(), username: username.trim() });
    } finally {
      setSending(false);
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
        أقرب تكسي في الدانا وسرمدا
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{ font: "800 19px/1.35 FreePalestine,Tajawal,sans-serif", flex: 1 }}>إنشاء حساب جديد</div>
          <button onClick={onLogin} style={linkBtnStyle}>لدي حساب ←</button>
        </div>
        <div style={{ font: "400 12.5px/1.6 'IBM Plex Sans Arabic',sans-serif", color: '#575757', marginBottom: 18 }}>
          عبّئ بياناتك مرة واحدة، ويصلك رمز التحقق على بريدك.
        </div>

        <label style={labelStyle}>الاسم الكامل</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: محمد الأحمد" style={{ ...inputStyle, marginBottom: 14 }} />

        <label style={labelStyle}>رقم الهاتف المحمول</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="09xxxxxxxx"
          inputMode="tel"
          style={{ ...inputStyle, marginBottom: 14, direction: 'ltr', textAlign: 'right' }}
        />

        <label style={labelStyle}>البريد الإلكتروني</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@mail.com"
          inputMode="email"
          style={{ ...inputStyle, marginBottom: 14, direction: 'ltr', textAlign: 'right' }}
        />

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 130 }}>
            <label style={labelStyle}>اسم المستخدم</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 130 }}>
            <label style={labelStyle}>كلمة المرور</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="••••••"
              style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }}
            />
          </div>
        </div>

        {error && <div style={errorBoxStyle}>{error}</div>}

        <button onClick={sendOtp} disabled={sending} style={{ ...primaryBtnStyle, opacity: sending ? 0.6 : 1 }}>
          {sending ? '...جارٍ الإرسال' : 'أرسل رمز التحقق'}
        </button>
      </div>
      <div
        style={{
          marginTop: 'auto',
          paddingTop: 18,
          textAlign: 'center',
          font: "400 11.5px/1.6 'IBM Plex Sans Arabic',sans-serif",
          color: '#8b8b8b'
        }}
      >
        يعمل بدون متجر تطبيقات · أضِفه للشاشة الرئيسية
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

const linkBtnStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--color-green)',
  font: "700 12.5px/1.35 'IBM Plex Sans Arabic',sans-serif",
  cursor: 'pointer'
};

const errorBoxStyle: CSSProperties = {
  marginTop: 12,
  background: '#fdecec',
  color: '#b3261e',
  borderRadius: 11,
  padding: '10px 12px',
  font: "600 12px/1.5 'IBM Plex Sans Arabic',sans-serif"
};
