"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, rateLimit, uuid } from "@/lib/action-utils";
import { coupleCtx } from "@/lib/couple-ctx";
import { pingPartner } from "@/lib/push";
import { STICKER_IDS } from "@/lib/stickers";

const okPath = (path: string, coupleId: string) =>
  path.startsWith(`${coupleId}/chat/`) && !path.includes("..") && path.length < 300;

export async function sendTextMessageAction(input: { body: string; replyTo?: string }) {
  const p = z.object({ body: z.string().trim().min(1).max(4000), replyTo: uuid.optional() }).safeParse(input);
  if (!p.success) return fail("invalid");
  const c = await coupleCtx();
  if (!c) return fail("auth");
  if (!c.couple.partner_id) return fail("forbidden");
  if (!rateLimit(`msg:${c.uid}`, 60, 60_000)) return fail("rate");
  const { data, error } = await c.supabase
    .from("messages")
    .insert({ couple_id: c.couple.id, kind: "text", body: p.data.body, reply_to: p.data.replyTo ?? null })
    .select("id, couple_id, author_id, kind, body, storage_path, duration_ms, reply_to, edited_at, deleted_at, created_at")
    .single();
  if (error || !data) return fail("generic");
  void pingPartner("message");
  return ok(data);
}

export async function sendStickerMessageAction(input: { stickerId: string; replyTo?: string }) {
  const p = z.object({ stickerId: z.enum(STICKER_IDS), replyTo: uuid.optional() }).safeParse(input);
  if (!p.success) return fail("invalid");
  const c = await coupleCtx();
  if (!c) return fail("auth");
  if (!c.couple.partner_id) return fail("forbidden");
  if (!rateLimit(`msg:${c.uid}`, 60, 60_000)) return fail("rate");
  const { data, error } = await c.supabase
    .from("messages")
    .insert({ couple_id: c.couple.id, kind: "sticker", body: p.data.stickerId, reply_to: p.data.replyTo ?? null })
    .select("id, couple_id, author_id, kind, body, storage_path, duration_ms, reply_to, edited_at, deleted_at, created_at")
    .single();
  if (error || !data) return fail("generic");
  void pingPartner("message");
  return ok(data);
}

const mediaInput = z.object({
  kind: z.enum(["image", "audio"]),
  path: z.string().min(10).max(300),
  durationMs: z.number().int().min(0).max(600_000).optional(),
  replyTo: uuid.optional(),
});

/** Called after the browser uploaded the file to the private bucket (path is verified here). */
export async function sendMediaMessageAction(input: z.infer<typeof mediaInput>) {
  const p = mediaInput.safeParse(input);
  if (!p.success) return fail("invalid");
  const c = await coupleCtx();
  if (!c) return fail("auth");
  if (!c.couple.partner_id) return fail("forbidden");
  if (!rateLimit(`msg:${c.uid}`, 40, 60_000)) return fail("rate");
  if (!okPath(p.data.path, c.couple.id)) return fail("forbidden");
  const { data, error } = await c.supabase
    .from("messages")
    .insert({ couple_id: c.couple.id, kind: p.data.kind, storage_path: p.data.path, duration_ms: p.data.durationMs ?? null, reply_to: p.data.replyTo ?? null })
    .select("id, couple_id, author_id, kind, body, storage_path, duration_ms, reply_to, edited_at, deleted_at, created_at")
    .single();
  if (error || !data) {
    await c.supabase.storage.from("couple-media").remove([p.data.path]);
    return fail("generic");
  }
  void pingPartner("message");
  return ok(data);
}

export async function editMessageAction(input: { id: string; body: string }) {
  const p = z.object({ id: uuid, body: z.string().trim().min(1).max(4000) }).safeParse(input);
  if (!p.success) return fail("invalid");
  const c = await coupleCtx();
  if (!c) return fail("auth");
  const { data, error } = await c.supabase.from("messages").update({ body: p.data.body }).eq("id", p.data.id).eq("author_id", c.uid).eq("kind", "text").select("id");
  return error || !data?.length ? fail("forbidden") : ok();
}

export async function deleteMessageAction(id: string) {
  const p = uuid.safeParse(id);
  if (!p.success) return fail("invalid");
  const c = await coupleCtx();
  if (!c) return fail("auth");
  const { data, error } = await c.supabase.from("messages").select("storage_path").eq("id", p.data).eq("author_id", c.uid).single();
  if (error || !data) return fail("forbidden");
  const { error: e2 } = await c.supabase.from("messages").update({ deleted_at: new Date().toISOString() }).eq("id", p.data).eq("author_id", c.uid);
  if (e2) return fail("generic");
  if (data.storage_path) await c.supabase.storage.from("couple-media").remove([data.storage_path]);
  return ok();
}

export async function markMessagesReadAction() {
  const c = await coupleCtx();
  if (!c) return fail("auth");
  const { error } = await c.supabase
    .from("message_cursors")
    .upsert({ couple_id: c.couple.id, last_read_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return fail("generic");
  revalidatePath("/messages");
  return ok();
}
