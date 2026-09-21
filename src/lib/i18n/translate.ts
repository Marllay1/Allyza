import type { Dict } from "@/locales/fr";

type StrPaths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : T[K] extends string[]
      ? never
      : StrPaths<T[K], `${P}${K}.`>;
}[keyof T & string];

type ArrPaths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string[]
    ? `${P}${K}`
    : T[K] extends string
      ? never
      : ArrPaths<T[K], `${P}${K}.`>;
}[keyof T & string];

export type TKey = StrPaths<Dict>;
export type TArrKey = ArrPaths<Dict>;
export type Vars = Record<string, string | number>;

export type Translator = {
  (key: TKey, vars?: Vars): string;
  arr: (key: TArrKey) => string[];
};

function dig(dict: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], dict);
}

/** Builds a translator over one dictionary. Never falls back to another language silently. */
export function createT(dict: Dict): Translator {
  const t = ((key: TKey, vars?: Vars) => {
    const v = dig(dict, key);
    if (typeof v !== "string") return key;
    return vars ? v.replace(/\{(\w+)\}/g, (_, n) => String(vars[n] ?? `{${n}}`)) : v;
  }) as Translator;
  t.arr = (key) => {
    const v = dig(dict, key);
    return Array.isArray(v) ? (v as string[]) : [];
  };
  return t;
}
