import { useState, type CSSProperties } from 'react';
import { supabase } from '../lib/supabase';
import type { SignupPayload } from './Signup';

interface OtpVerifyProps {
  payload: SignupPayload;
  onVerified: () => void;
  onBack: () => void;
}

// Ported from index.html's uOtpForm block. Real verification against Supabase
// Auth's own OTP (type: 'signup') instead of the prototype's demoOtp constant;
// on success we create the `riders` profile row for the now-authenticated user.
export default function OtpVerify({ payload, onVerified, onBack }: OtpVerifyProps) {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);

  const verify = async () => {
    if (otp.trim().length !== 6) {
      setError('أدخل الرمز المكوّن من 6 أرقام.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: payload.email,
        token: otp.trim(),
        type: 'signup'
      });
      if (verifyError || !data.user) {
        setError('الرمز غير صحيح، حاول مرة أخرى.');
        return;
      }
      const { error: insertError } = await supabase.from('riders').insert({
        id: data.user.id,
        name: payload.name,
        email: payload.email,
        username: payload.username,
        status: 'active'
      });
      if (insertError) {
        setError('تم التحقق لكن تعذّر إنشاء الملف الشخصي — تواصل مع الدعم.');
        return;
      }
      // Phone lives on its own table (0021), not the riders row -- so a
      // matched driver can never read it via RLS, only the rider and admin.
      const { error: contactError } = await supabase.from('rider_contacts').insert({ rider_id: data.user.id, phone: payload.phone });
      if (contactError) {
        setError('تم التحقق لكن تعذّر حفظ رقم الهاتف — تواصل مع الدعم.');
        return;
      }
      onVerified();
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError('');
    setResent(false);
    await supabase.auth.resend({ type: 'signup', email: payload.email });
    setResent(true);
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '28px 24px', display: 'flex', flexDirection: 'column' }}>
      <button onClick={onBack} style={backBtnStyle}>→ رجوع</button>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          background: 'var(--color-yellow)',
          display: 'grid',
          placeItems: 'center',
          margin: '20px 0 16px',
          fontSize: 26
        }}
      >
        ✉
      </div>
      <div style={{ font: "900 22px/1.2 FreePalestine,Tajawal,sans-serif" }}>رمز التحقق</div>
      <div style={{ font: "400 13px/1.7 'IBM Plex Sans Arabic',sans-serif", color: '#575757', margin: '8px 0 18px' }}>
        أرسلنا رمزاً من 6 أرقام إلى{' '}
        <span style={{ color: 'var(--color-black)', fontWeight: 700, direction: 'ltr', display: 'inline-block' }}>
          {payload.email}
        </span>
      </div>
      <input
        value={otp}
        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        placeholder="······"
        style={{
          width: '100%',
          padding: 18,
          border: '1.5px solid #e7e1d0',
          borderRadius: 16,
          background: '#faf8f2',
          font: "700 26px/1.35 Tajawal,sans-serif",
          letterSpacing: 14,
          textAlign: 'center',
          direction: 'ltr'
        }}
      />
      {error && (
        <div style={{ marginTop: 12, background: '#fdecec', color: '#b3261e', borderRadius: 11, padding: '10px 12px', font: "600 12px/1.5 'IBM Plex Sans Arabic',sans-serif" }}>
          {error}
        </div>
      )}
      {resent && !error && (
        <div style={{ marginTop: 12, background: '#eaf6ef', color: '#00662a', borderRadius: 11, padding: '10px 12px', font: "600 12px/1.5 'IBM Plex Sans Arabic',sans-serif" }}>
          أُعيد إرسال الرمز.
        </div>
      )}
      <button onClick={verify} disabled={busy} style={{ ...confirmBtnStyle, opacity: busy ? 0.6 : 1 }}>
        {busy ? '...جارٍ التأكيد' : 'تأكيد ودخول'}
      </button>
      <button onClick={resend} style={resendBtnStyle}>إعادة إرسال الرمز</button>
    </div>
  );
}

const backBtnStyle: CSSProperties = {
  alignSelf: 'flex-start',
  background: 'none',
  border: 'none',
  color: '#575757',
  font: "600 13px/1.35 'IBM Plex Sans Arabic',sans-serif",
  cursor: 'pointer',
  padding: '6px 0'
};

const confirmBtnStyle: CSSProperties = {
  width: '100%',
  marginTop: 20,
  padding: 15,
  border: 'none',
  borderRadius: 14,
  background: 'var(--color-green)',
  color: '#fff',
  font: "800 15px/1.35 Tajawal,sans-serif",
  cursor: 'pointer'
};

const resendBtnStyle: CSSProperties = {
  width: '100%',
  marginTop: 10,
  padding: 13,
  border: '1.5px solid #e7e1d0',
  borderRadius: 14,
  background: '#fff',
  color: '#575757',
  font: "700 13px/1.35 'IBM Plex Sans Arabic',sans-serif",
  cursor: 'pointer'
};
