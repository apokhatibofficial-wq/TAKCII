import { useEffect, useState } from 'react';
import Splash from './screens/Splash';
import Login from './screens/Login';
import Signup, { type SignupPayload } from './screens/Signup';
import OtpVerify from './screens/OtpVerify';
import Home from './screens/Home';

type Screen = 'login' | 'signup' | 'otp' | 'home';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [screen, setScreen] = useState<Screen>('login');
  const [pendingSignup, setPendingSignup] = useState<SignupPayload | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 3400);
    return () => clearTimeout(t);
  }, []);

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
