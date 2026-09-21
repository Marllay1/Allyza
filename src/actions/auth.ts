"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, rateLimit, type ErrCode } from "@/lib/action-utils";
import { getLocale } from "@/lib/i18n/server";

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(8).max(128);

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}
const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function signUpAction(input: { email: string; password: string; displayName: string; role: string }) {
  const parsed = z
    .object({ email, password, displayName: z.string().trim().min(1).max(40), role: z.enum(["her", "partner"]) })
    .safeParse(input);
  if (!parsed.success) {
    const weak = parsed.error.issues.some((i) => i.path[0] === "password");
    return fail(weak ? "weak_password" : "invalid");
  }
  if (!rateLimit(`signup:${await clientIp()}`, 8, 60 * 60_000)) return fail("rate");

  const supabase = await createClient();
  const locale = await getLocale();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/callback`,
      data: { role: parsed.data.role, display_name: parsed.data.displayName, locale },
    },
  });
  if (error) return fail(error.message.toLowerCase().includes("registered") ? "email_taken" : "generic");
  // Supabase hides "already registered" behind an empty identities list when confirmation is on.
  if (data.user && data.user.identities?.length === 0) return fail("email_taken");
  if (data.session) redirect("/home");
  return ok({ confirm: true });
}

export async function signInAction(input: { email: string; password: string }) {
  const parsed = z.object({ email, password: z.string().min(1).max(128) }).safeParse(input);
  if (!parsed.success) return fail("credentials");
  const ip = await clientIp();
  if (!rateLimit(`login:${ip}`, 20, 15 * 60_000) || !rateLimit(`login:${parsed.data.email}`, 8, 15 * 60_000)) {
    return fail("rate");
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return fail("credentials");
  redirect("/home");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function forgotPasswordAction(input: { email: string }) {
  const parsed = z.object({ email }).safeParse(input);
  if (!parsed.success) return fail("invalid");
  if (!rateLimit(`forgot:${await clientIp()}`, 5, 60 * 60_000)) return fail("rate");
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/reset`,
  });
  // Always report success: never reveal whether an address has an account.
  return ok();
}

export async function resetPasswordAction(input: { password: string }) {
  const parsed = z.object({ password }).safeParse(input);
  if (!parsed.success) return fail("weak_password");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return fail("auth");
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail("generic");
  redirect("/home");
}

export async function changePasswordAction(input: { current: string; next: string }) {
  const parsed = z.object({ current: z.string().min(1).max(128), next: password }).safeParse(input);
  if (!parsed.success) return fail("weak_password");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email) return fail("auth");
  if (!rateLimit(`chpw:${data.user.id}`, 5, 15 * 60_000)) return fail("rate");
  // Re-verify the current password before allowing the change.
  const check = await supabase.auth.signInWithPassword({ email: data.user.email, password: parsed.data.current });
  if (check.error) return fail("credentials");
  const { error } = await supabase.auth.updateUser({ password: parsed.data.next });
  return error ? fail("generic") : ok();
}

/** Removes the user's uploaded files, then the account (cascades to every table). */
export async function deleteAccountAction(input: { password: string }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email) return fail("auth");
  if (!rateLimit(`del:${data.user.id}`, 3, 60 * 60_000)) return fail("rate");
  const check = await supabase.auth.signInWithPassword({ email: data.user.email, password: input.password });
  if (check.error) return fail("credentials");

  // If she deletes, her couple (and everyone's uploads in it) goes with her.
  const { data: couple } = await supabase.from("couples").select("id, her_id").maybeSingle();
  const admin = createAdminClient();
  if (admin && couple) {
    const ownedByHer = couple.her_id === data.user.id;
    const folders = ownedByHer ? [couple.id, `${couple.id}/vault`] : [];
    for (const folder of folders) {
      const { data: files } = await admin.storage.from("couple-media").list(folder, { limit: 1000 });
      const paths = (files ?? []).filter((f) => f.id).map((f) => `${folder}/${f.name}`);
      if (paths.length) await admin.storage.from("couple-media").remove(paths);
    }
  }
  const { error } = await supabase.rpc("delete_my_account");
  if (error) return fail("generic");
  await supabase.auth.signOut();
  redirect("/login?deleted=1");
}

export type AuthErr = ErrCode;
