import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { supabase } from './src/lib/supabase';
import { useDriverProfile } from './src/hooks/useDriverProfile';
import Login from './src/screens/Login';
import Signup from './src/screens/Signup';
import Pending from './src/screens/Pending';
import Home from './src/screens/Home';
import { COLORS } from './src/theme';
import ErrorBoundary from './src/ErrorBoundary';

type AuthScreen = 'login' | 'signup';

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}

function AppInner() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');
  const { driver, loading, setDriver } = useDriverProfile(userId ?? null);

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

  if (resolving || blocked) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.black} size="large" />
      </View>
    );
  }

  if (!userId) {
    return (
      <>
        {authScreen === 'login' ? (
          <Login onSignup={() => setAuthScreen('signup')} onLoggedIn={() => {}} />
        ) : (
          <Signup onLogin={() => setAuthScreen('login')} onSubmitted={() => setAuthScreen('login')} />
        )}
        <StatusBar style="dark" />
      </>
    );
  }

  if (!driver) return null;

  return (
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

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white }
});
