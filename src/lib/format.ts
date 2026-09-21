import type { Locale } from "@/lib/i18n/config";

/** Parse yyyy-mm-dd as a LOCAL calendar date (avoids the classic UTC off-by-one). */
export const parseLocalDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const formatDay = (iso: string, locale: Locale, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" }) =>
  new Intl.DateTimeFormat(locale, opts).format(parseLocalDate(iso));

export const formatDateTime = (isoTs: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(isoTs));

export const MOOD_EMOJI = ["😞", "🙁", "😐", "🙂", "😊"] as const;
