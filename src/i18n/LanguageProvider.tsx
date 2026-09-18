import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import ptBR from '../locales/pt-BR';
import en from '../locales/en';

export type Locale = 'pt-BR' | 'en';

const STORAGE_KEY = 'fincontrol_locale';
const catalogs = {
  'pt-BR': ptBR,
  en,
} as const;

type Catalog = typeof ptBR;

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  months: readonly string[];
  translateCategory: (name: string) => string;
  dateLocale: string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function readStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'pt-BR') return stored;
  } catch {
    // ignore
  }
  return 'pt-BR';
}

function getByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, part) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[part];
  }, obj);
}

function interpolate(
  template: string,
  vars?: Record<string, string | number>
): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
    vars[name] === undefined || vars[name] === null ? '' : String(vars[name])
  );
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [locale, setLocaleState] = useState<Locale>(() => readStoredLocale());

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === 'en' ? 'en' : 'pt-BR';
    document.title =
      locale === 'en'
        ? 'FinControl — Personal Finance'
        : 'FinControl — Controle Financeiro Pessoal';
  }, [locale]);

  const catalog = catalogs[locale] as Catalog;

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const value = getByPath(catalog, key);
      if (typeof value === 'string') {
        return interpolate(value, vars);
      }
      // Fallback to pt-BR then key
      const fallback = getByPath(ptBR, key);
      if (typeof fallback === 'string') {
        return interpolate(fallback, vars);
      }
      return key;
    },
    [catalog]
  );

  const months = catalog.months;

  const translateCategory = useCallback(
    (name: string) => {
      const mapped = (catalog.categories as Record<string, string>)[name];
      return mapped || name;
    },
    [catalog]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      months,
      translateCategory,
      dateLocale: locale === 'en' ? 'en-US' : 'pt-BR',
    }),
    [locale, setLocale, t, months, translateCategory]
  );

  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
};

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within LanguageProvider');
  }
  return ctx;
}

export function useTranslation() {
  const { t, locale, setLocale, months, translateCategory, dateLocale } =
    useI18n();
  return { t, locale, setLocale, months, translateCategory, dateLocale };
}
