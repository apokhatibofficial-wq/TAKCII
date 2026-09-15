import type { CSSProperties, ReactNode } from 'react';
import { useLang } from '../i18n/LangContext';
import { supabase } from '../lib/supabase';

export type TabId = 'users' | 'drivers' | 'available' | 'ratings' | 'places' | 'pricing' | 'messages' | 'ads' | 'settings';

const TABS: { id: TabId; labelKey: keyof ReturnType<typeof useLang>['t']; titleKey: keyof ReturnType<typeof useLang>['t'] }[] = [
  { id: 'users', labelKey: 'navUsers', titleKey: 'ttlUsers' },
  { id: 'drivers', labelKey: 'navDrivers', titleKey: 'ttlDrivers' },
  { id: 'available', labelKey: 'navAvailable', titleKey: 'ttlAvailable' },
  { id: 'ratings', labelKey: 'navRatings', titleKey: 'ttlRatings' },
  { id: 'places', labelKey: 'navPlaces', titleKey: 'ttlPlaces' },
  { id: 'pricing', labelKey: 'navPricing', titleKey: 'ttlPricing' },
  { id: 'messages', labelKey: 'navMessages', titleKey: 'ttlMessages' },
  { id: 'ads', labelKey: 'navAds', titleKey: 'ttlAds' },
  { id: 'settings', labelKey: 'navSettings', titleKey: 'ttlSettings' }
];

export default function Layout({ active, onChange, children }: { active: TabId; onChange: (t: TabId) => void; children: ReactNode }) {
  const { t, lang, dir, setLang } = useLang();
  const activeTab = TABS.find((x) => x.id === active)!;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', direction: dir }}>
      <aside style={sidebarStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 16px 20px' }}>
          <img src="/assets/logo-light.png" alt="TAK-C.TAXI" style={{ height: 26, width: 'auto' }} />
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 10px', flex: 1 }}>
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => onChange(tab.id)} style={navBtnStyle(tab.id === active)}>
              {t[tab.labelKey]}
            </button>
          ))}
        </nav>
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,.08)', borderRadius: 10, padding: 3 }}>
            <button onClick={() => setLang('ar')} style={langBtnStyle(lang === 'ar')}>
              عربي
            </button>
            <button onClick={() => setLang('en')} style={langBtnStyle(lang === 'en')}>
              English
            </button>
          </div>
          <button onClick={() => supabase.auth.signOut()} style={logoutBtnStyle}>
            {t.logout}
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, minWidth: 0, background: '#f6f4ee' }}>
        <header style={headerStyle}>
          <div style={{ font: "800 19px/1.3 'IBM Plex Sans Arabic',sans-serif" }}>{t[activeTab.titleKey]}</div>
        </header>
        <div style={{ padding: '22px 28px 40px' }}>{children}</div>
      </main>
    </div>
  );
}

const sidebarStyle: CSSProperties = {
  width: 230,
  flex: 'none',
  background: 'var(--color-black)',
  color: 'rgba(244,239,225,.85)',
  display: 'flex',
  flexDirection: 'column',
  position: 'sticky',
  top: 0,
  height: '100vh'
};

const navBtnStyle = (active: boolean): CSSProperties => ({
  textAlign: 'inherit',
  padding: '11px 13px',
  border: 'none',
  borderRadius: 11,
  cursor: 'pointer',
  font: "700 13px/1.35 'IBM Plex Sans Arabic',sans-serif",
  background: active ? 'rgba(253,228,3,.14)' : 'transparent',
  color: active ? 'var(--color-yellow)' : 'rgba(244,239,225,.78)'
});

const langBtnStyle = (active: boolean): CSSProperties => ({
  flex: 1,
  padding: '7px 8px',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  font: "700 11.5px/1.3 'IBM Plex Sans Arabic',sans-serif",
  background: active ? 'var(--color-yellow)' : 'transparent',
  color: active ? 'var(--color-black)' : 'rgba(244,239,225,.75)'
});

const logoutBtnStyle: CSSProperties = {
  padding: '10px 12px',
  border: '1px solid rgba(244,239,225,.18)',
  borderRadius: 10,
  background: 'transparent',
  color: '#f2a8a8',
  font: "700 12.5px/1.35 'IBM Plex Sans Arabic',sans-serif",
  cursor: 'pointer'
};

const headerStyle: CSSProperties = {
  padding: '20px 28px',
  background: '#fff',
  borderBottom: '1px solid #ece6d6',
  position: 'sticky',
  top: 0,
  zIndex: 5
};
