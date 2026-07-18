import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import en from "@/locales/en.json";
import ro from "@/locales/ro.json";
import { BRAND_NAME } from "@/components/brand";

export type Locale = "en" | "ro";

export const LOCALES: {
  code: Locale;
  flag: string;
  labelKey: "language.en" | "language.ro";
  shortKey: "language.enShort" | "language.roShort";
}[] = [
  { code: "en", flag: "🇬🇧", labelKey: "language.en", shortKey: "language.enShort" },
  { code: "ro", flag: "🇷🇴", labelKey: "language.ro", shortKey: "language.roShort" },
];

const STORAGE_KEY = "global-pulse-locale";
const LEGACY_STORAGE_KEY = "global-pulse-landing-locale";

const dictionaries: Record<Locale, typeof en> = { en, ro };

export type Dictionary = typeof en;

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    params[key] !== undefined ? String(params[key]) : `{{${key}}}`,
  );
}

function detectInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "ro" || stored === "en") return stored;

  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacy === "ro" || legacy === "en") {
    localStorage.setItem(STORAGE_KEY, legacy);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return legacy;
  }

  const browserLang = navigator.language ?? navigator.languages?.[0] ?? "en";
  return browserLang.toLowerCase().startsWith("ro") ? "ro" : "en";
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  dict: Dictionary;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => detectInitialLocale());

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const dict = dictionaries[locale];

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const value = getByPath(dict as Record<string, unknown>, key);
      if (typeof value === "string") {
        return interpolate(value, {
          brand: BRAND_NAME,
          year: new Date().getFullYear(),
          ...params,
        });
      }
      return key;
    },
    [dict],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, dict }),
    [locale, setLocale, t, dict],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

/** Shorthand hook — returns the translation function. */
export function useT() {
  return useI18n().t;
}
