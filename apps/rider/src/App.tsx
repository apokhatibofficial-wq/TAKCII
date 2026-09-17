import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import Splash from './screens/Splash';
import Login from './screens/Login';
import Signup, { type SignupPayload } from './screens/Signup';
import OtpVerify from './screens/OtpVerify';
import Home from './screens/Home';

type Screen = 'login' | 'signup' | 'otp' | 'home';

export default function App() {
  const [timerDone, setTimerDone] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [screen, setScreen] = useState<Screen>('login');
  const [pendingSignup, setPendingSignup] = useState<SignupPayload | null>(null);

  // The splash is a full-screen overlay, so it also covers the brief gap
  // while we check for an already-persisted session — without this check
  // the app always started at Login, ignoring a perfectly valid saved
  // session (persistSession is on, but nothing ever read it back on load).
  useEffect(() => {
    const t = setTimeout(() => setTimerDone(true), 3400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (data.session) setScreen('home');
      })
      .catch(() => undefined)
      .finally(() => setSessionChecked(true));
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) setScreen('login');
    });
    return () => subscription.unsubscribe();
  }, []);

  const showSplash = !timerDone || !sessionChecked;

  return (
    <div className="app-shell" dir="rtl">
      {showSplash && <Splash />}

      {screen === 'login' && <Login onSignup={() => setScreen('signup')} onLoggedIn={() => setScreen('home')} />}

      {screen === 'signup' && (
        <Signup
          onLogin={() => setScreen('login')}
          onSent={(payload) => {
            setPendingSignup(payload);
            setScreen('otp');
          }}
        />
      )}

      {screen === 'otp' && pendingSignup && (
        <OtpVerify payload={pendingSignup} onBack={() => setScreen('signup')} onVerified={() => setScreen('home')} />
      )}

      {screen === 'home' && <Home />}
    </div>
  );
}
