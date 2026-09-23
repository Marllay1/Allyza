"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { LANG_COOKIE, THEME_COOKIE } from "@/lib/i18n/config";
import { fail, ok, rateLimit } from "@/lib/action-utils";
import { getAuthUser } from "@/lib/supabase/request";

const cookieOpts = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production" };

export async function setLocaleAction(input: string) {
  const parsed = z.enum(["fr", "en"]).safeParse(input);
  if (!parsed.success) return fail("invalid");
  (await cookies()).set(LANG_COOKIE, parsed.data, cookieOpts);
  const user = await getAuthUser();
  if (user) { const supabase = await createClient(); await supabase.from("user_preferences").update({ locale: parsed.data }).eq("user_id", user.id); }
  revalidatePath("/", "layout");
  return ok();
}

export async function setThemeAction(input: string) {
  const parsed = z.enum(["system", "light", "dark"]).safeParse(input);
  if (!parsed.success) return fail("invalid");
  (await cookies()).set(THEME_COOKIE, parsed.data, cookieOpts);
  const user = await getAuthUser();
  if (user) { const supabase = await createClient(); await supabase.from("user_preferences").update({ theme: parsed.data }).eq("user_id", user.id); }
  revalidatePath("/", "layout");
  return ok();
}

const prefSchema = z.object({
  soft_mode: z.boolean().optional(),
  notify_journal: z.boolean().optional(),
  notify_media: z.boolean().optional(),
  notify_refuge: z.boolean().optional(),
  notify_little: z.boolean().optional(),
  notify_surprise: z.boolean().optional(),
  notify_message: z.boolean().optional(),
});

export async function updatePrefsAction(input: z.infer<typeof prefSchema>) {
  const parsed = prefSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const user = await getAuthUser();
  if (!user) return fail("auth");
  if (!rateLimit(`prefs:${user.id}`, 60, 60_000)) return fail("rate");
  const supabase = await createClient();
  const { error } = await supabase.from("user_preferences").update(parsed.data).eq("user_id", user.id);
  if (error) return fail("generic");
  revalidatePath("/", "layout");
  return ok();
}

export async function updateDisplayNameAction(name: string) {
  const parsed = z.string().trim().min(1).max(40).safeParse(name);
  if (!parsed.success) return fail("invalid");
  const user = await getAuthUser();
  if (!user) return fail("auth");
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ display_name: parsed.data }).eq("id", user.id);
  if (error) return fail("generic");
  revalidatePath("/", "layout");
  return ok();
}
