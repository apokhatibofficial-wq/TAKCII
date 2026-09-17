import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { COLORS } from '../theme';

interface LoginProps {
  onSignup: () => void;
  onLoggedIn: () => void;
}

// Ported from index.html's dLoginScreen block. Driver status (pending vs
// suspended) is only known after the email->status lookup, matching the
// prototype's distinct handling of each.
export default function Login({ onSignup, onLoggedIn }: LoginProps) {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const doLogin = async () => {
    if (!loginId.trim() || !password) {
      setError('أدخل اسم المستخدم أو رقم الهاتف وكلمة المرور.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { data, error: fnError } = await supabase.functions.invoke<{ email: string; status: string }>('resolve-login-email', {
        body: { loginId: loginId.trim(), role: 'driver' }
      });
      if (fnError || !data?.email) {
        setError('لا يوجد حساب بهذا الاسم أو الرقم.');
        return;
      }
      if (data.status === 'suspended') {
        setError('هذا الحساب موقوف — راجع الإدارة.');
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: data.email, password });
      if (signInError) {
        setError('كلمة المرور غير صحيحة.');
        return;
      }
      onLoggedIn();
    } catch (e) {
      // Anything that throws instead of returning {error} (a genuine network
      // failure, a bug in a dependency) was silently swallowed before — busy
      // still cleared via finally, but with no visible feedback at all, which
      // looked exactly like "briefly loads then does nothing." Surfacing the
      // real message is what actually lets this get diagnosed and fixed.
      setError(`خطأ غير متوقع: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>دخول السائق</Text>
      <Text style={styles.subtitle}>اسم المستخدم أو رقم الهاتف وكلمة المرور التي زوّدك بها الأدمن.</Text>

      <Text style={styles.label}>اسم المستخدم أو رقم الهاتف</Text>
      <TextInput value={loginId} onChangeText={setLoginId} placeholder="username أو 09xxxxxxxx" style={styles.input} autoCapitalize="none" />

      <Text style={styles.label}>كلمة المرور</Text>
      <TextInput value={password} onChangeText={setPassword} placeholder="••••••" secureTextEntry style={styles.input} />

      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Pressable onPress={doLogin} disabled={busy} style={[styles.primaryBtn, busy && { opacity: 0.6 }]}>
        {busy ? <ActivityIndicator color={COLORS.yellow} /> : <Text style={styles.primaryBtnText}>دخول</Text>}
      </Pressable>

      <Pressable onPress={onSignup} style={styles.secondaryBtn}>
        <Text style={styles.secondaryBtnText}>تسجيل سائق جديد</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.white, padding: 24, justifyContent: 'center' },
  logo: { width: 140, height: 100, alignSelf: 'center', marginBottom: 18 },
  title: { fontSize: 20, fontWeight: '900', textAlign: 'right', color: COLORS.black },
  subtitle: { fontSize: 12.5, color: COLORS.textMuted, textAlign: 'right', marginTop: 6, marginBottom: 20, lineHeight: 19 },
  label: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted, textAlign: 'right', marginBottom: 7 },
  input: {
    borderWidth: 1.5,
    borderColor: '#e7e1d0',
    borderRadius: 13,
    backgroundColor: '#faf8f2',
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    textAlign: 'right',
    marginBottom: 14
  },
  errorBox: { backgroundColor: '#fdecec', borderRadius: 11, padding: 12, marginBottom: 4 },
  errorText: { color: COLORS.danger, fontSize: 12, fontWeight: '600', textAlign: 'right' },
  primaryBtn: { backgroundColor: COLORS.black, borderRadius: 14, paddingVertical: 15, marginTop: 14, alignItems: 'center' },
  primaryBtnText: { color: COLORS.yellow, fontWeight: '800', fontSize: 15 },
  secondaryBtn: { borderWidth: 1.5, borderColor: '#e7e1d0', borderRadius: 14, paddingVertical: 13, marginTop: 10, alignItems: 'center' },
  secondaryBtnText: { color: COLORS.black, fontWeight: '700', fontSize: 13.5 }
});
