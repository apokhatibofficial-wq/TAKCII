import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { LangProvider } from './i18n/LangContext';
import Login from './screens/Login';
import Layout, { type TabId } from './layout/Layout';
import Users from './tabs/Users';
import Drivers from './tabs/Drivers';
import Available from './tabs/Available';
import Ratings from './tabs/Ratings';
import Places from './tabs/Places';
import Pricing from './tabs/Pricing';
import Messages from './tabs/Messages';
import Ads from './tabs/Ads';
import Settings from './tabs/Settings';

const TAB_VIEWS: Record<TabId, React.ComponentType> = {
  users: Users,
  drivers: Drivers,
  available: Available,
  ratings: Ratings,
  places: Places,
  pricing: Pricing,
  messages: Messages,
  ads: Ads,
  settings: Settings
};

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [tab, setTab] = useState<TabId>('users');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) return null;

  if (!session) {
    return (
      <LangProvider>
        <Login onLoggedIn={() => {}} />
      </LangProvider>
    );
  }

  const TabView = TAB_VIEWS[tab];
  return (
    <LangProvider>
      <Layout active={tab} onChange={setTab}>
        <TabView />
      </Layout>
    </LangProvider>
  );
}
