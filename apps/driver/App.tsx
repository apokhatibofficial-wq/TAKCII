import { useEffect, useState, type ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Sentry from '@sentry/react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold, Tajawal_800ExtraBold, Tajawal_900Black } from '@expo-google-fonts/tajawal';
import { supabase } from './src/lib/supabase';
import { useDriverProfile } from './src/hooks/useDriverProfile';
import Login from './src/screens/Login';
import Signup from './src/screens/Signup';
import Pending from './src/screens/Pending';
import Home from './src/screens/Home';
import { COLORS } from './src/theme';
import ErrorBoundary from './src/ErrorBoundary';
import { readAndClearLastCrash, readAndClearLastBreadcrumb } from './src/lib/crashLog';

type AuthScreen = 'login' | 'signup';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function App() {
  const [fontsLoaded] = useFonts({ Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold, Tajawal_800ExtraBold, Tajawal_900Black });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded]);

  // Keeps the native splash on screen rather than flashing default-font text
  // for a frame — every screen in this app renders Arabic through Tajawal.
  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}

// A no-op wrapper until EXPO_PUBLIC_SENTRY_DSN is set (src/lib/sentry.ts) —
// adds React render-tree context to whatever Sentry.init captures.
export default Sentry.wrap(App);

function AppInner() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');
  const [lastCrash, setLastCrash] = useState<Awaited<ReturnType<typeof readAndClearLastCrash>>>(null);
  const [lastBreadcrumb, setLastBreadcrumb] = useState<Awaited<ReturnType<typeof readAndClearLastBreadcrumb>>>(null);
  const { driver, loading, setDriver } = useDriverProfile(userId ?? null);

  // Surfaces whatever installGlobalCrashLogger (index.ts) persisted right
  // before an uncaught JS exception took the app down last time, plus the
  // last Home.tsx breadcrumb (crashLog.ts) for a crash that never reaches
  // ErrorUtils at all — the only way to see either without device/logcat
  // access. Not cleared: unlike the crash record, "last screen reached"
  // stays useful across repeated launches until a fresh one overwrites it.
  useEffect(() => {
    readAndClearLastCrash().then(setLastCrash);
    readAndClearLastBreadcrumb().then(setLastBreadcrumb);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // An admin suspending this driver (or a missing profile row) should kick
  // them back to the login screen, matching the prototype's editUser action
  // on the currently-logged-in driver.
  useEffect(() => {
    if (userId && !loading && (!driver || driver.status === 'suspended')) {
      supabase.auth.signOut();
    }
  }, [userId, loading, driver]);

  const resolving = userId === undefined || (!!userId && loading);
  const blocked = !!userId && !loading && (!driver || driver.status === 'suspended');

  let body: ReactNode;
  if (resolving || blocked) {
    body = (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.black} size="large" />
      </View>
    );
  } else if (!userId) {
    body = (
      <>
        {authScreen === 'login' ? (
          <Login onSignup={() => setAuthScreen('signup')} onLoggedIn={() => {}} />
        ) : (
          <Signup onLogin={() => setAuthScreen('login')} onSubmitted={() => setAuthScreen('login')} />
        )}
        <StatusBar style="dark" />
      </>
    );
  } else if (!driver) {
    body = null;
  } else {
    body = (
      <>
        {driver.status === 'pending' ? (
          <Pending driver={driver} onApproved={() => setDriver({ ...driver, status: 'active' })} />
        ) : (
          <Home driver={driver} setDriver={setDriver} onLogout={() => supabase.auth.signOut()} />
        )}
        <StatusBar style={driver.status === 'active' ? 'light' : 'dark'} />
      </>
    );
  }

  return (
    <>
      {body}
      {(lastCrash || lastBreadcrumb) && (
        <View style={styles.crashBanner}>
          <ScrollView style={styles.crashScroll}>
            {lastCrash && (
              <>
                <Text style={styles.crashTitle}>تعطل التطبيق آخر مرة — سبب الخطأ:</Text>
                <Text style={styles.crashMessage}>{lastCrash.message}</Text>
                {!!lastCrash.stack && <Text style={styles.crashStack}>{lastCrash.stack}</Text>}
              </>
            )}
            {lastBreadcrumb && (
              <>
                <Text style={styles.crashTitle}>آخر نقطة وصلها التطبيق قبل إغلاقه:</Text>
                <Text style={styles.crashMessage}>{lastBreadcrumb.step}</Text>
                <Text style={styles.crashStack}>{lastBreadcrumb.at}</Text>
              </>
            )}
          </ScrollView>
          <Pressable
            onPress={() => {
              setLastCrash(null);
              setLastBreadcrumb(null);
            }}
            style={styles.crashClose}
          >
            <Text style={styles.crashCloseText}>إغلاق</Text>
          </Pressable>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white },
  crashBanner: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 24,
    maxHeight: '55%',
    backgroundColor: '#1c1c1c',
    borderRadius: 16,
    padding: 14,
    elevation: 8
  },
  crashScroll: { maxHeight: 220 },
  crashTitle: { color: COLORS.danger, fontWeight: '800', fontSize: 13, textAlign: 'right', marginBottom: 8 },
  crashMessage: { color: COLORS.white, fontWeight: '700', fontSize: 12.5, textAlign: 'right', marginBottom: 8 },
  crashStack: { color: '#bbb', fontSize: 10, writingDirection: 'ltr', textAlign: 'left' },
  crashClose: { marginTop: 10, alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 22, borderRadius: 10, backgroundColor: COLORS.yellow },
  crashCloseText: { color: COLORS.black, fontWeight: '800', fontSize: 12.5 }
});
