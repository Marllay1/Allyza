import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { fr } from "@/locales/fr";
import { en } from "@/locales/en";
import { LANG_COOKIE, isLocale, pickLocaleFromHeader, type Locale } from "./config";
import { createT } from "./translate";

export const dictionaries = { fr, en } as const;

export const getLocale = cache(async (): Promise<Locale> => {
  const c = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLocale(c)) return c;
  return pickLocaleFromHeader((await headers()).get("accept-language"));
});

export async function getT() {
  const locale = await getLocale();
  return { t: createT(dictionaries[locale]), locale };
}
