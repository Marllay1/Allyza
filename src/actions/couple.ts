"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, rateLimit } from "@/lib/action-utils";

export async function joinCoupleAction(code: string) {
  const p = z.string().trim().min(6).max(24).safeParse(code);
  if (!p.success) return fail("invalid_code");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return fail("auth");
  // Invite codes are high entropy, but still throttle guessing.
  if (!rateLimit(`join:${data.user.id}`, 6, 15 * 60_000)) return fail("rate");
  const { error } = await supabase.rpc("join_couple", { p_code: p.data });
  if (error) {
    if (error.message.includes("already_linked")) return fail("already_linked");
    if (error.message.includes("not_partner")) return fail("not_partner");
    return fail("invalid_code");
  }
  revalidatePath("/", "layout");
  return ok();
}

export async function unlinkPartnerAction() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return fail("auth");
  const { error } = await supabase.rpc("unlink_partner");
  if (error) return fail("generic");
  revalidatePath("/", "layout");
  return ok();
}

export async function regenerateInviteAction() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return fail("auth");
  const { error } = await supabase.rpc("regenerate_invite");
  if (error) return fail("generic");
  revalidatePath("/", "layout");
  return ok();
}
