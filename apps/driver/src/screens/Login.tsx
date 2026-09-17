import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { COLORS } from '../theme';

interface LoginProps {
  onSignup: () => void;
  onLoggedIn: () => void;
}

// Temporary diagnostic build marker + step-by-step on-screen log. Every fix
// so far (url-polyfill, try/catch, error boundary) tested clean via a plain
// Node.js script hitting the exact same endpoints, yet the real device still
// silently lands back on this screen with zero error from any of those nets
// — which stops making sense unless either the failure is somewhere this
// specific runtime hits that Node never can, or the device is still running
// a stale build. BUILD_MARKER answers "is this really the new code," and the
// log answers "which exact step it gets to" — both remove guessing entirely.
const BUILD_MARKER = 'BUILD-DIAG-3';

// Ported from index.html's dLoginScreen block. Driver status (pending vs
// suspended) is only known after the email->status lookup, matching the
// prototype's distinct handling of each.
export default function Login({ onSignup, onLoggedIn }: LoginProps) {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const pushLog = (msg: string) => setLog((l) => [...l, `${new Date().toISOString().slice(11, 19)} ${msg}`]);

  const doLogin = async () => {
    if (!loginId.trim() || !password) {
      setError('أدخل اسم المستخدم أو رقم الهاتف وكلمة المرور.');
      return;
    }
    setBusy(true);
    setError('');
    setLog([]);
    try {
      pushLog('1/4 calling resolve-login-email…');
      const { data, error: fnError } = await supabase.functions.invoke<{ email: string; status: string }>('resolve-login-email', {
        body: { loginId: loginId.trim(), role: 'driver' }
      });
      pushLog(`1/4 done: data=${JSON.stringify(data)} error=${JSON.stringify(fnError)}`);
      if (fnError || !data?.email) {
        setError('لا يوجد حساب بهذا الاسم أو الرقم.');
        return;
      }
      if (data.status === 'suspended') {
        setError('هذا الحساب موقوف — راجع الإدارة.');
        return;
      }
      pushLog('2/4 calling signInWithPassword…');
      // A screenshot from BUILD-DIAG-1 showed the log stopping right after
      // this line — resolve-login-email had already returned in under a
      // second, but signInWithPassword never printed its "done" line before
      // the screenshot was taken. A tick every 3s while it's still pending,
      // plus a hard 15s timeout, tells us whether it eventually resolves
      // slowly or genuinely never does — a distinction that changes what
      // the real fix even could be.
      const tick = setInterval(() => pushLog('2/4 … still waiting on signInWithPassword'), 3000);
      const signInPromise = supabase.auth.signInWithPassword({ email: data.email, password });
      const timeoutPromise = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 15000));
      const raceResult = await Promise.race([signInPromise, timeoutPromise]);
      clearInterval(tick);
      if (raceResult === 'timeout') {
        pushLog('2/4 TIMEOUT: signInWithPassword did not resolve within 15s');
        setError('انتهت مهلة الاتصال بالخادم أثناء تسجيل الدخول.');
        // Still await it in the background so we at least log a late result.
        signInPromise.then(
          (r) => pushLog(`2/4 (late) resolved: session=${!!r.data?.session} error=${JSON.stringify(r.error)}`),
          (e) => pushLog(`2/4 (late) rejected: ${e instanceof Error ? e.message : String(e)}`)
        );
        return;
      }
      const { data: signInData, error: signInError } = raceResult;
      pushLog(`2/4 done: session=${!!signInData?.session} userId=${signInData?.user?.id ?? 'none'} error=${JSON.stringify(signInError)}`);
      if (signInError) {
        setError('كلمة المرور غير صحيحة.');
        return;
      }
      pushLog('3/4 sign-in ok, verifying getSession() reads it back…');
      const { data: sessionCheck } = await supabase.auth.getSession();
      pushLog(`3/4 getSession() -> session present=${!!sessionCheck.session}`);
      pushLog('4/4 calling onLoggedIn()');
      onLoggedIn();
    } catch (e) {
      // Anything that throws instead of returning {error} (a genuine network
      // failure, a bug in a dependency) was silently swallowed before — busy
      // still cleared via finally, but with no visible feedback at all, which
      // looked exactly like "briefly loads then does nothing." Surfacing the
      // real message is what actually lets this get diagnosed and fixed.
      pushLog(`THREW: ${e instanceof Error ? e.message : String(e)}`);
      setError(`خطأ غير متوقع: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.buildMarker}>{BUILD_MARKER}</Text>
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

      {log.length > 0 && (
        <View style={styles.logBox}>
          {log.map((l, i) => (
            <Text key={i} style={styles.logText}>
              {l}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, backgroundColor: COLORS.white, padding: 24, justifyContent: 'center' },
  buildMarker: { fontSize: 10, color: COLORS.textMuted, textAlign: 'center', writingDirection: 'ltr', marginBottom: 6 },
  logBox: { marginTop: 18, backgroundColor: '#f4f4f4', borderRadius: 11, padding: 10 },
  logText: { fontSize: 10, color: COLORS.black, writingDirection: 'ltr', textAlign: 'left', marginBottom: 3 },
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
