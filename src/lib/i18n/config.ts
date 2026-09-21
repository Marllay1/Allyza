export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";
export const LANG_COOKIE = "allyza_lang";
export const THEME_COOKIE = "allyza_theme";

export const isLocale = (v: unknown): v is Locale =>
  typeof v === "string" && (LOCALES as readonly string[]).includes(v);

export const pickLocaleFromHeader = (header: string | null | undefined): Locale =>
  header?.toLowerCase().startsWith("en") ? "en" : DEFAULT_LOCALE;
