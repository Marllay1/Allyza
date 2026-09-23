"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, rateLimit } from "@/lib/action-utils";
import {
  clearUnlocked, consumeChallenge, getLockRow, hashSecret, isUnlocked, issueChallenge, requestOrigin, setUnlocked, verifySecret,
} from "@/lib/app-lock";
import { getAuthUser } from "@/lib/supabase/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAssertion, verifyRegistrationClientData } from "@/lib/webauthn-verify";

const MAX_FAILS = 5;
const LOCKOUT_MS = 5 * 60_000;
const IDLE_CHOICES = [0, 60, 300, 900] as const;

const pin = z.string().regex(/^\d{4,8}$/);
const password = z.string().min(6).max(72);

async function who() {
  const user = await getAuthUser();
  const admin = createAdminClient();
  if (!user || !admin) return null;
  return { uid: user.id, admin };
}

/** Changing or removing protection needs the current secret (or, for a first activation, nothing). */
async function mayChange(uid: string, current: string | undefined) {
  const row = await getLockRow(uid);
  if (!row) return { ok: true as const, row: null };
  if (!(await isUnlocked(uid))) return { ok: false as const, error: "forbidden" as const };
  if (!current || !(await verifySecret(current, row.secret_hash))) return { ok: false as const, error: "wrong_secret" as const };
  return { ok: true as const, row };
}

const setInput = z.object({
  method: z.enum(["pin", "password"]),
  secret: z.string(),
  confirm: z.string(),
  current: z.string().optional(),
  idleSeconds: z.number().refine((n) => (IDLE_CHOICES as readonly number[]).includes(n)).optional(),
});

export async function setAppLockAction(input: z.infer<typeof setInput>) {
  const p = setInput.safeParse(input);
  if (!p.success) return fail("invalid");
  if (p.data.secret !== p.data.confirm) return fail("invalid");
  if (!(p.data.method === "pin" ? pin : password).safeParse(p.data.secret).success) return fail(p.data.method === "pin" ? "invalid" : "weak_password");
  const c = await who();
  if (!c) return fail("auth");
  if (!rateLimit(`applock:${c.uid}`, 15, 60_000)) return fail("rate");
  const allowed = await mayChange(c.uid, p.data.current);
  if (!allowed.ok) return fail(allowed.error);

  const { error } = await c.admin.from("app_locks").upsert({
    user_id: c.uid, method: p.data.method, secret_hash: await hashSecret(p.data.secret),
    idle_seconds: p.data.idleSeconds ?? allowed.row?.idle_seconds ?? 60, failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString(),
  });
  if (error) return fail("generic");
  await c.admin.from("app_lock_credentials").delete().eq("user_id", c.uid);
  await setUnlocked(c.uid);
  revalidatePath("/settings", "layout");
  return ok();
}

export async function disableAppLockAction(input: { current: string }) {
  const c = await who();
  if (!c) return fail("auth");
  if (!rateLimit(`applock:${c.uid}`, 15, 60_000)) return fail("rate");
  const allowed = await mayChange(c.uid, input.current);
  if (!allowed.ok) return fail(allowed.error);
  await c.admin.from("app_lock_credentials").delete().eq("user_id", c.uid);
  await c.admin.from("app_locks").delete().eq("user_id", c.uid);
  await clearUnlocked();
  revalidatePath("/settings", "layout");
  return ok();
}

export async function setIdleSecondsAction(input: { seconds: number }) {
  if (!(IDLE_CHOICES as readonly number[]).includes(input.seconds)) return fail("invalid");
  const c = await who();
  if (!c) return fail("auth");
  const row = await getLockRow(c.uid);
  if (!row || !(await isUnlocked(c.uid))) return fail("forbidden");
  await c.admin.from("app_locks").update({ idle_seconds: input.seconds }).eq("user_id", c.uid);
  revalidatePath("/", "layout");
  return ok();
}

/** Wrong guesses are counted server-side and lock the screen for five minutes after five in a row. */
export async function unlockAppAction(input: { secret: string }) {
  const c = await who();
  if (!c) return fail("auth");
  const row = await getLockRow(c.uid);
  if (!row) return ok(); // nothing to unlock
  if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) return fail("app_locked", { retryAt: row.locked_until });
  if (!(await verifySecret(String(input.secret ?? "").slice(0, 200), row.secret_hash))) {
    const fails = row.failed_attempts + 1;
    await c.admin.from("app_locks").update(fails >= MAX_FAILS
      ? { failed_attempts: 0, locked_until: new Date(Date.now() + LOCKOUT_MS).toISOString() }
      : { failed_attempts: fails }).eq("user_id", c.uid);
    return fails >= MAX_FAILS ? fail("app_locked", { retryAt: new Date(Date.now() + LOCKOUT_MS).toISOString() }) : fail("wrong_secret");
  }
  await c.admin.from("app_locks").update({ failed_attempts: 0, locked_until: null }).eq("user_id", c.uid);
  await setUnlocked(c.uid);
  return ok();
}

export async function lockAppNowAction() {
  await clearUnlocked();
  return ok();
}

/* ───────── biometrics: a platform passkey (Face ID / Touch ID / Android biometrics) ───────── */

export async function beginBiometricRegistrationAction() {
  const c = await who();
  if (!c) return fail("auth");
  if (!rateLimit(`applock:${c.uid}`, 15, 60_000)) return fail("rate");
  const { data: profile } = await c.admin.from("profiles").select("display_name").eq("id", c.uid).maybeSingle();
  const { rpId } = await requestOrigin();
  return ok({ challenge: await issueChallenge(c.uid), userId: c.uid, name: profile?.display_name ?? "Allyza", rpId });
}

const registerInput = z.object({
  credentialId: z.string().min(8).max(1024),
  publicKey: z.string().min(40).max(2048),
  clientDataJSON: z.string().max(4096),
  backupPin: pin,
  confirm: z.string(),
  current: z.string().optional(),
  idleSeconds: z.number().refine((n) => (IDLE_CHOICES as readonly number[]).includes(n)).optional(),
});

/** Stores the device's public key and a backup PIN (for when the biometric prompt fails or is unavailable). */
export async function finishBiometricRegistrationAction(input: z.infer<typeof registerInput>) {
  const p = registerInput.safeParse(input);
  if (!p.success || p.data.backupPin !== p.data.confirm) return fail("invalid");
  const c = await who();
  if (!c) return fail("auth");
  const allowed = await mayChange(c.uid, p.data.current);
  if (!allowed.ok) return fail(allowed.error);
  const challenge = await consumeChallenge(c.uid);
  const { origin } = await requestOrigin();
  if (!challenge || !verifyRegistrationClientData(p.data.clientDataJSON, challenge, origin)) return fail("forbidden");

  await c.admin.from("app_lock_credentials").delete().eq("user_id", c.uid);
  const { error: e1 } = await c.admin.from("app_lock_credentials").insert({ user_id: c.uid, credential_id: p.data.credentialId, public_key: p.data.publicKey });
  if (e1) return fail("generic");
  const { error: e2 } = await c.admin.from("app_locks").upsert({
    user_id: c.uid, method: "biometric", secret_hash: await hashSecret(p.data.backupPin),
    idle_seconds: p.data.idleSeconds ?? allowed.row?.idle_seconds ?? 60, failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString(),
  });
  if (e2) return fail("generic");
  await setUnlocked(c.uid);
  revalidatePath("/settings", "layout");
  return ok();
}

export async function beginBiometricUnlockAction() {
  const c = await who();
  if (!c) return fail("auth");
  const row = await getLockRow(c.uid);
  if (!row || row.method !== "biometric") return fail("forbidden");
  if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) return fail("app_locked", { retryAt: row.locked_until });
  const { data: creds } = await c.admin.from("app_lock_credentials").select("credential_id").eq("user_id", c.uid);
  const { rpId } = await requestOrigin();
  return ok({ challenge: await issueChallenge(c.uid), credentialIds: (creds ?? []).map((x) => x.credential_id as string), rpId });
}

const assertionInput = z.object({
  credentialId: z.string().max(1024),
  clientDataJSON: z.string().max(4096),
  authenticatorData: z.string().max(2048),
  signature: z.string().max(2048),
});

export async function finishBiometricUnlockAction(input: z.infer<typeof assertionInput>) {
  const p = assertionInput.safeParse(input);
  if (!p.success) return fail("invalid");
  const c = await who();
  if (!c) return fail("auth");
  const row = await getLockRow(c.uid);
  if (!row || row.method !== "biometric") return fail("forbidden");
  if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) return fail("app_locked", { retryAt: row.locked_until });
  const [challenge, { data: cred }, { origin, rpId }] = await Promise.all([
    consumeChallenge(c.uid),
    c.admin.from("app_lock_credentials").select("public_key").eq("user_id", c.uid).eq("credential_id", p.data.credentialId).maybeSingle(),
    requestOrigin(),
  ]);
  if (!challenge || !cred || !verifyAssertion({ input: p.data, publicKeySpkiB64: cred.public_key, expectedChallenge: challenge, expectedOrigin: origin, rpId })) {
    return fail("wrong_secret");
  }
  await c.admin.from("app_locks").update({ failed_attempts: 0, locked_until: null }).eq("user_id", c.uid);
  await setUnlocked(c.uid);
  return ok();
}
