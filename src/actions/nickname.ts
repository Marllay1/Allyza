"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, rateLimit } from "@/lib/action-utils";
import { coupleCtx } from "@/lib/couple-ctx";

export async function setNicknameAction(nickname: string) {
  const p = z.string().trim().min(1).max(40).safeParse(nickname);
  if (!p.success) return fail("invalid");
  const c = await coupleCtx();
  if (!c || !c.couple.partner_id) return fail("auth");
  if (!rateLimit(`nickname:${c.uid}`, 20, 60_000)) return fail("rate");
  const partnerId = c.uid === c.couple.her_id ? c.couple.partner_id : c.couple.her_id;
  const { error } = await c.supabase
    .from("nicknames")
    .upsert({ target_id: partnerId, nickname: p.data, updated_at: new Date().toISOString() }, { onConflict: "owner_id,target_id" });
  if (error) return fail("generic");
  revalidatePath("/", "layout");
  return ok();
}
