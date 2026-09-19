import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { COLORS, FONT } from '../theme';

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

  // Logo slides in from the right (RTL-natural entrance) with a gentle
  // overshoot-settle and a scale-up, then the form follows a beat later
  // so the reveal reads as one sequence rather than everything popping
  // in at once.
  const logoSlide = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.88)).current;
  const formSlide = useRef(new Animated.Value(1)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoSlide, { toValue: 0, speed: 6, bounciness: 8, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 650, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, speed: 6, bounciness: 8, useNativeDriver: true })
      ]),
      Animated.parallel([
        Animated.timing(formSlide, { toValue: 0, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(formOpacity, { toValue: 1, duration: 520, easing: Easing.out(Easing.quad), useNativeDriver: true })
      ])
    ]).start();
  }, []);

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
      // A genuine network failure or dependency bug throws instead of
      // returning {error} — without this, busy still cleared via finally
      // but with zero visible feedback, indistinguishable from the screen
      // just doing nothing.
      setError(`خطأ غير متوقع: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ImageBackground source={require('../../assets/login-bg.jpg')} style={styles.bg} resizeMode="cover">
      <LinearGradient
        colors={['rgba(24,22,25,0.55)', 'rgba(24,22,25,0.82)', COLORS.black]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView contentContainerStyle={styles.wrap}>
        <Animated.View
          style={{
            opacity: logoOpacity,
            transform: [
              { translateX: logoSlide.interpolate({ inputRange: [0, 1], outputRange: [0, 220] }) },
              { scale: logoScale }
            ]
          }}
        >
          <Image source={require('../../assets/logo-yellow.png')} style={styles.logo} resizeMode="contain" />
        </Animated.View>

        <Animated.View
          style={{
            opacity: formOpacity,
            transform: [{ translateY: formSlide.interpolate({ inputRange: [0, 1], outputRange: [0, 26] }) }]
          }}
        >
          <Text style={styles.title}>دخول السائق</Text>
          <Text style={styles.subtitle}>اسم المستخدم أو رقم الهاتف وكلمة المرور التي زوّدك بها الأدمن.</Text>

          <View style={styles.card}>
            <Text style={styles.label}>اسم المستخدم أو رقم الهاتف</Text>
            <TextInput
              value={loginId}
              onChangeText={setLoginId}
              placeholder="username أو 09xxxxxxxx"
              placeholderTextColor="rgba(244,239,225,0.45)"
              style={styles.input}
              autoCapitalize="none"
            />

            <Text style={styles.label}>كلمة المرور</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••"
              placeholderTextColor="rgba(244,239,225,0.45)"
              secureTextEntry
              style={styles.input}
            />

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Pressable onPress={doLogin} disabled={busy} style={[styles.primaryBtn, busy && { opacity: 0.6 }]}>
              {busy ? <ActivityIndicator color={COLORS.black} /> : <Text style={styles.primaryBtnText}>دخول</Text>}
            </Pressable>

            <Pressable onPress={onSignup} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>تسجيل سائق جديد</Text>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.black },
  wrap: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  logo: { width: '100%', height: 92, marginBottom: 34 },
  title: { fontSize: 21, fontFamily: FONT.heavy, textAlign: 'right', color: COLORS.white },
  subtitle: { fontSize: 12.5, fontFamily: FONT.regular, color: 'rgba(244,239,225,0.75)', textAlign: 'right', marginTop: 6, marginBottom: 22, lineHeight: 19 },
  card: {
    backgroundColor: 'rgba(244,239,225,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(244,239,225,0.16)',
    borderRadius: 20,
    padding: 18
  },
  label: { fontSize: 12, fontFamily: FONT.medium, color: 'rgba(244,239,225,0.7)', textAlign: 'right', marginBottom: 7 },
  input: {
    borderWidth: 1.5,
    borderColor: 'rgba(244,239,225,0.22)',
    borderRadius: 13,
    backgroundColor: 'rgba(24,22,25,0.35)',
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.white,
    textAlign: 'right',
    marginBottom: 14
  },
  errorBox: { backgroundColor: 'rgba(179,38,30,0.18)', borderRadius: 11, padding: 12, marginBottom: 4, borderWidth: 1, borderColor: 'rgba(179,38,30,0.4)' },
  errorText: { color: '#ff8a80', fontSize: 12, fontFamily: FONT.medium, textAlign: 'right' },
  primaryBtn: { backgroundColor: COLORS.yellow, borderRadius: 14, paddingVertical: 15, marginTop: 14, alignItems: 'center' },
  primaryBtnText: { color: COLORS.black, fontFamily: FONT.extraBold, fontSize: 15 },
  secondaryBtn: { borderWidth: 1.5, borderColor: 'rgba(244,239,225,0.3)', borderRadius: 14, paddingVertical: 13, marginTop: 10, alignItems: 'center' },
  secondaryBtnText: { color: COLORS.white, fontFamily: FONT.bold, fontSize: 13.5 }
});
