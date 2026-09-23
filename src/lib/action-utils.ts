import "server-only";
import { z } from "zod";
import { getAuthUser } from "@/lib/supabase/request";

/** Error codes are translation keys under `errors.*`: the UI never shows raw server text. */
export type ErrCode =
  | "generic"
  | "invalid"
  | "rate"
  | "auth"
  | "forbidden"
  | "not_found"
  | "wrong_pin"
  | "locked"
  | "weak_password"
  | "credentials";

export type Result<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: ErrCode; retryAt?: string };

export const ok = <T = undefined>(data?: T) =>
  ({ ok: true, ...(data === undefined ? {} : { data }) }) as Result<T>;
export const fail = (error: ErrCode, extra?: { retryAt?: string }) =>
  ({ ok: false, error, ...extra }) as { ok: false; error: ErrCode; retryAt?: string };

// Best-effort limiter (per server instance). The database adds its own hard limits
// where it matters (vault PIN lockout). Swap for Upstash/Redis at scale.
const buckets = new Map<string, number[]>();
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) for (const [k, v] of buckets) if (!v.length || now - v[v.length - 1] > windowMs) buckets.delete(k);
  return true;
}

/** Authenticated user id from the verified session, or null. Never re-checks against Supabase:
 * proxy.ts already verified this request once and this just reads that result. */
export async function currentUserId(): Promise<string | null> {
  const user = await getAuthUser();
  return user?.id ?? null;
}

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const uuid = z.string().uuid();
