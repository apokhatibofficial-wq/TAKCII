import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { COLORS } from '../theme';

interface SignupProps {
  onLogin: () => void;
  onSubmitted: () => void;
}

// Ported from index.html's dFormScreen block: no OTP for drivers (admin
// reviews manually). Account creation goes through the driver-signup Edge
// Function (service-role, confirms the email immediately) rather than a
// plain supabase.auth.signUp() — this project runs with mailer_autoconfirm
// off for riders' real OTP emails, so an unconfirmed self-signup here would
// never be able to sign in at all.
export default function Signup({ onLogin, onSubmitted }: SignupProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [plate, setPlate] = useState('');
  const [car, setCar] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim() || !phone.trim() || !username.trim() || !password) {
      setError('الاسم والهاتف واسم المستخدم وكلمة المرور مطلوبة (6 محارف على الأقل).');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { data: taken } = await supabase.rpc('is_username_taken', { candidate: username.trim() });
      if (taken) {
        setError('اسم المستخدم محجوز — اختر اسماً آخر.');
        return;
      }
      const { data, error: fnError } = await supabase.functions.invoke<{ id: string }>('driver-signup', {
        body: {
          name: name.trim(),
          phone: phone.trim(),
          username: username.trim(),
          password,
          plate: plate.trim() || undefined,
          car: car.trim() || undefined
        }
      });
      if (fnError || !data?.id) {
        setError('تعذّر إنشاء الحساب، حاول لاحقاً.');
        return;
      }
      const email = `${username.trim()}@tak-c.taxi`;
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        // Account was created fine; only the immediate sign-in failed here —
        // the driver can still log in normally from the login screen.
        onSubmitted();
      }
    } catch (e) {
      // Same gap as Login.tsx's doLogin: anything that throws instead of
      // returning {error} was silently swallowed before, clearing busy via
      // finally with zero visible feedback.
      setError(`خطأ غير متوقع: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>تسجيل سائق جديد</Text>
      <Text style={styles.subtitle}>يراجع الأدمن طلبك يدوياً قبل التفعيل — لا يوجد رمز تحقق للسائقين.</Text>

      <Field label="الاسم الكامل" value={name} onChangeText={setName} placeholder="الاسم الثلاثي" />
      <View style={styles.row}>
        <Field label="رقم الهاتف" value={phone} onChangeText={setPhone} placeholder="09xxxxxxxx" style={{ flex: 1 }} />
        <Field label="رقم اللوحة" value={plate} onChangeText={setPlate} placeholder="123456" style={{ flex: 1 }} />
      </View>
      <Field label="نوع السيارة" value={car} onChangeText={setCar} placeholder="مثال: هيونداي أكسنت 2014 — بيضاء" />
      <View style={styles.row}>
        <Field label="اسم المستخدم" value={username} onChangeText={setUsername} placeholder="username" style={{ flex: 1 }} />
        <Field label="كلمة المرور" value={password} onChangeText={setPassword} placeholder="••••••" secureTextEntry style={{ flex: 1 }} />
      </View>

      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Pressable onPress={submit} disabled={busy} style={[styles.primaryBtn, busy && { opacity: 0.6 }]}>
        {busy ? <ActivityIndicator color={COLORS.yellow} /> : <Text style={styles.primaryBtnText}>إرسال الطلب للمراجعة</Text>}
      </Pressable>
      <Pressable onPress={onLogin} style={styles.secondaryBtn}>
        <Text style={styles.secondaryBtnText}>لدي حساب — تسجيل الدخول</Text>
      </Pressable>
    </ScrollView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  style?: object;
}) {
  return (
    <View style={[styles.field, props.style]}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        secureTextEntry={props.secureTextEntry}
        style={styles.input}
        autoCapitalize="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 22, backgroundColor: COLORS.white },
  title: { fontSize: 18, fontWeight: '900', textAlign: 'right', color: COLORS.black },
  subtitle: { fontSize: 12, color: COLORS.textMuted, textAlign: 'right', marginTop: 5, marginBottom: 16, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 10 },
  field: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted, textAlign: 'right', marginBottom: 7 },
  input: { borderWidth: 1.5, borderColor: '#e7e1d0', borderRadius: 13, backgroundColor: '#faf8f2', paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, textAlign: 'right' },
  errorBox: { backgroundColor: '#fdecec', borderRadius: 11, padding: 12, marginTop: 2, marginBottom: 4 },
  errorText: { color: COLORS.danger, fontSize: 12, fontWeight: '600', textAlign: 'right' },
  primaryBtn: { backgroundColor: COLORS.black, borderRadius: 14, paddingVertical: 15, marginTop: 16, alignItems: 'center' },
  primaryBtnText: { color: COLORS.yellow, fontWeight: '800', fontSize: 14 },
  secondaryBtn: { borderWidth: 1.5, borderColor: '#e7e1d0', borderRadius: 14, paddingVertical: 12, marginTop: 9, alignItems: 'center' },
  secondaryBtnText: { color: COLORS.textMuted, fontWeight: '700', fontSize: 12.5 }
});
