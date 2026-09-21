"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, rateLimit } from "@/lib/action-utils";
import { normalizeUsername, usernameToEmail } from "@/lib/username";

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

/** Sign in with a username. The session is a secure, persistent cookie (refreshed automatically). */
export async function signInAction(input: { username: string; password: string }) {
  const parsed = z.object({ username: z.string().trim().min(2).max(40), password: z.string().min(1).max(128) }).safeParse(input);
  if (!parsed.success) return fail("credentials");
  const user = normalizeUsername(parsed.data.username);
  if (!user) return fail("credentials");
  if (!rateLimit(`login:ip:${await clientIp()}`, 20, 15 * 60_000) || !rateLimit(`login:user:${user}`, 8, 15 * 60_000)) {
    return fail("rate");
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(user), password: parsed.data.password });
  if (error) return fail("credentials");
  redirect("/home");
}

/** Explicit logout: invalidates the session server-side; the next visit asks for the password again. */
export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Change the password after re-verifying the current one. */
export async function changePasswordAction(input: { current: string; next: string }) {
  const parsed = z.object({ current: z.string().min(1).max(128), next: z.string().min(8).max(128) }).safeParse(input);
  if (!parsed.success) return fail("weak_password");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email) return fail("auth");
  if (!rateLimit(`chpw:${data.user.id}`, 5, 15 * 60_000)) return fail("rate");
  const check = await supabase.auth.signInWithPassword({ email: data.user.email, password: parsed.data.current });
  if (check.error) return fail("credentials");
  const { error } = await supabase.auth.updateUser({ password: parsed.data.next });
  return error ? fail("generic") : ok();
}
