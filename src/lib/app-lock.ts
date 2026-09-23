import "server-only";
import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

const UNLOCK_COOKIE = "allyza_unlock";
const CHALLENGE_COOKIE = "allyza_wa";
const UNLOCK_TTL_S = 12 * 3600;

export type LockMethod = "pin" | "password" | "biometric";
export type LockRow = { method: LockMethod; secret_hash: string; idle_seconds: number; failed_attempts: number; locked_until: string | null };

const key = () => process.env.APP_LOCK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const sign = (v: string) => createHmac("sha256", key()).update(v).digest("base64url");
const cookieOpts = (maxAge?: number) => ({ httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", ...(maxAge ? { maxAge } : {}) });

const scryptAsync = (secret: string, salt: Buffer, len: number, N: number, r: number, p: number) =>
  new Promise<Buffer>((res, rej) => scrypt(secret, salt, len, { N, r, p, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? rej(e) : res(k))));

/** Salted scrypt: `scrypt$N$r$p$salt$hash`. The PIN / password itself is never stored anywhere. */
export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(secret, salt, 32, 16384, 8, 1);
  return `scrypt$16384$8$1$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const [alg, N, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scryptAsync(secret, Buffer.from(salt, "base64"), expected.length, Number(N), Number(r), Number(p));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function getLockRow(uid: string): Promise<LockRow | null> {
  const admin = createAdminClient();
  if (!admin || !key()) return null;
  const { data } = await admin.from("app_locks").select("method, secret_hash, idle_seconds, failed_attempts, locked_until").eq("user_id", uid).maybeSingle();
  return (data as LockRow | null) ?? null;
}

export const isLockedOut = (row: LockRow) => !!row.locked_until && new Date(row.locked_until).getTime() > Date.now();

export async function isUnlocked(uid: string): Promise<boolean> {
  const raw = (await cookies()).get(UNLOCK_COOKIE)?.value;
  if (!raw) return false;
  const [id, exp, sig] = raw.split(".");
  if (id !== uid || !exp || Number(exp) < Date.now() / 1000 || !sig) return false;
  const good = sign(`${id}.${exp}`);
  return sig.length === good.length && timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}

export async function setUnlocked(uid: string) {
  const exp = Math.floor(Date.now() / 1000) + UNLOCK_TTL_S;
  (await cookies()).set(UNLOCK_COOKIE, `${uid}.${exp}.${sign(`${uid}.${exp}`)}`, cookieOpts(UNLOCK_TTL_S));
}

export async function clearUnlocked() {
  (await cookies()).set(UNLOCK_COOKIE, "", cookieOpts(0));
}

/** A one-time WebAuthn challenge, bound to the user and valid for two minutes. */
export async function issueChallenge(uid: string): Promise<string> {
  const challenge = randomBytes(32).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 120;
  (await cookies()).set(CHALLENGE_COOKIE, `${uid}.${challenge}.${exp}.${sign(`${uid}.${challenge}.${exp}`)}`, cookieOpts(120));
  return challenge;
}

export async function consumeChallenge(uid: string): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(CHALLENGE_COOKIE)?.value;
  jar.set(CHALLENGE_COOKIE, "", cookieOpts(0));
  if (!raw) return null;
  const [id, challenge, exp, sig] = raw.split(".");
  if (id !== uid || !challenge || !exp || Number(exp) < Date.now() / 1000 || !sig) return null;
  const good = sign(`${id}.${challenge}.${exp}`);
  return sig.length === good.length && timingSafeEqual(Buffer.from(sig), Buffer.from(good)) ? challenge : null;
}

/** The origin and relying-party id the browser is actually using (a passkey is bound to both). */
export async function requestOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return { origin: `${proto}://${host}`, rpId: host.split(":")[0] };
}
