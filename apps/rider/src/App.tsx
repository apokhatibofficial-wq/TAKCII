import { useEffect, useState } from 'react';
import Splash from './screens/Splash';
import Login from './screens/Login';

type Screen = 'login' | 'signup';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [screen, setScreen] = useState<Screen>('login');

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 3400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="app-shell" dir="rtl">
      {showSplash && <Splash />}
      {screen === 'login' && <Login onSignup={() => setScreen('signup')} />}
      {screen === 'signup' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
          <div>
            <div style={{ font: "800 18px/1.3 FreePalestine,Tajawal,sans-serif", marginBottom: 8 }}>
              إنشاء حساب جديد
            </div>
            <div style={{ font: "400 13px/1.7 'IBM Plex Sans Arabic',sans-serif", color: '#575757' }}>
              تُبنى في المرحلة الثانية (المصادقة).
            </div>
            <button
              onClick={() => setScreen('login')}
              style={{
                marginTop: 16,
                background: 'none',
                border: 'none',
                color: 'var(--color-green)',
                font: "700 13px/1.35 'IBM Plex Sans Arabic',sans-serif",
                cursor: 'pointer'
              }}
            >
              → رجوع لتسجيل الدخول
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
