"use client";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Dict } from "@/locales/fr";
import type { Locale } from "./config";
import { createT, type Translator } from "./translate";

type Ctx = { locale: Locale; t: Translator };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dict;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ locale, t: createT(dict) }), [locale, dict]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
export const useT = () => useI18n().t;
