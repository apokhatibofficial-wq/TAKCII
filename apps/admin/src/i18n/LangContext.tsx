import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { AR, EN, type Lang, type Strings } from './strings';

interface LangCtx {
  lang: Lang;
  t: Strings;
  dir: 'rtl' | 'ltr';
  setLang: (l: Lang) => void;
}

const Ctx = createContext<LangCtx | null>(null);

const STORAGE_KEY = 'takc.admin.lang';

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY) as Lang) || 'ar';
    } catch {
      return 'ar';
    }
  });

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // ignore
    }
  };

  const value = useMemo<LangCtx>(
    () => ({ lang, t: lang === 'en' ? EN : AR, dir: lang === 'en' ? 'ltr' : 'rtl', setLang }),
    [lang]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLang must be used within LangProvider');
  return ctx;
}
