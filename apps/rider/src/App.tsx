import { useEffect, useState } from 'react';
import Splash from './screens/Splash';
import Login from './screens/Login';
import Signup, { type SignupPayload } from './screens/Signup';
import OtpVerify from './screens/OtpVerify';

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

      {screen === 'home' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
          <div>
            <div style={{ font: "800 18px/1.3 FreePalestine,Tajawal,sans-serif", marginBottom: 8 }}>
              تم تسجيل الدخول
            </div>
            <div style={{ font: "400 13px/1.7 'IBM Plex Sans Arabic',sans-serif", color: '#575757' }}>
              الخريطة والبحث والتسعير تُبنى في المرحلة الثالثة.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
