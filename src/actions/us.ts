"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, rateLimit, uuid } from "@/lib/action-utils";
import { LITTLE_KINDS, MEDIA_CATEGORIES, REACTION_EMOJIS } from "@/lib/constants";
import { stickerFromReaction } from "@/lib/stickers";
import { pingPartner } from "@/lib/push";
import { getAuthUser } from "@/lib/supabase/request";

async function ctx() {
  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) return null;
  // Couple id always comes from the database (RLS-limited), never from the client.
  const { data: couple } = await supabase.from("couples").select("id, her_id, partner_id").maybeSingle();
  if (!couple) return null;
  return { supabase, uid: user.id, couple };
}

/* ───────── journal ───────── */

const body = z.string().trim().min(1).max(4000);
const JOURNAL_MOODS = ["joy", "love", "calm", "tender", "nostalgia", "tired", "grateful"] as const;

export async function postJournalAction(input: { body: string; title?: string; mood?: string }) {
  const p = z.object({ body, title: z.string().trim().max(120).optional(), mood: z.enum(JOURNAL_MOODS).optional() }).safeParse(input);
  if (!p.success) return fail("invalid");
  const c = await ctx();
  if (!c) return fail("auth");
  if (!rateLimit(`journal:${c.uid}`, 40, 60_000)) return fail("rate");
  const { data, error } = await c.supabase
    .from("journal_entries")
    .insert({ couple_id: c.couple.id, body: p.data.body, title: p.data.title || null, mood: p.data.mood ?? null })
    .select("id, couple_id, author_id, title, body, mood, created_at, edited_at")
    .single();
  if (error || !data) return fail("generic");
  void pingPartner("journal");
  return ok(data);
}

export async function editJournalAction(input: { id: string; body: string; title?: string; mood?: string | null }) {
  const p = z.object({ id: uuid, body, title: z.string().trim().max(120).optional(), mood: z.enum(JOURNAL_MOODS).nullable().optional() }).safeParse(input);
  if (!p.success) return fail("invalid");
  const c = await ctx();
  if (!c) return fail("auth");
  const patch: Record<string, unknown> = { body: p.data.body };
  if (p.data.title !== undefined) patch.title = p.data.title || null;
  if (p.data.mood !== undefined) patch.mood = p.data.mood;
  const { data, error } = await c.supabase.from("journal_entries").update(patch).eq("id", p.data.id).eq("author_id", c.uid).select("id");
  return error || !data?.length ? fail("forbidden") : ok();
}

export async function deleteJournalAction(id: string) {
  const p = uuid.safeParse(id);
  if (!p.success) return fail("invalid");
  const c = await ctx();
  if (!c) return fail("auth");
  // Remove attached files first, then the row (media rows cascade with the entry).
  const { data: media } = await c.supabase.from("couple_media").select("storage_path").eq("entry_id", p.data).eq("author_id", c.uid);
  const { data, error } = await c.supabase.from("journal_entries").delete().eq("id", p.data).eq("author_id", c.uid).select("id");
  if (error || !data?.length) return fail("forbidden");
  if (media?.length) await c.supabase.storage.from("couple-media").remove(media.map((m) => m.storage_path));
  return ok();
}

/* ───────── media (photos) ───────── */

const mediaInput = z.object({
  path: z.string().min(10).max(300),
  category: z.enum(["journal", ...MEDIA_CATEGORIES]),
  caption: z.string().trim().max(300).optional(),
  takenOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  entryId: uuid.optional(),
});

/** Called after the browser uploaded the file to the private bucket (path is verified here). */
export async function registerMediaAction(input: z.infer<typeof mediaInput>) {
  const p = mediaInput.safeParse(input);
  if (!p.success) return fail("invalid");
  const c = await ctx();
  if (!c) return fail("auth");
  if (!rateLimit(`media:${c.uid}`, 30, 60_000)) return fail("rate");
  // The stored object must live under my couple's folder and must not be a vault path.
  if (!p.data.path.startsWith(`${c.couple.id}/`) || p.data.path.split("/")[1] === "vault" || p.data.path.includes("..")) return fail("forbidden");
  const { data, error } = await c.supabase
    .from("couple_media")
    .insert({
      couple_id: c.couple.id,
      category: p.data.category,
      storage_path: p.data.path,
      caption: p.data.caption || null,
      taken_on: p.data.takenOn,
      entry_id: p.data.entryId ?? null,
    })
    .select("id")
    .single();
  if (error || !data) {
    await c.supabase.storage.from("couple-media").remove([p.data.path]);
    return fail("generic");
  }
  if (p.data.category !== "journal") void pingPartner("media");
  revalidatePath("/us/memories");
  return ok({ id: data.id });
}

export async function updateCaptionAction(input: { id: string; caption: string }) {
  const p = z.object({ id: uuid, caption: z.string().trim().max(300) }).safeParse(input);
  if (!p.success) return fail("invalid");
  const c = await ctx();
  if (!c) return fail("auth");
  await c.supabase.from("couple_media").update({ caption: p.data.caption || null }).eq("id", p.data.id).eq("author_id", c.uid);
  revalidatePath("/us/memories");
  return ok();
}

export async function deleteMediaAction(id: string) {
  const p = uuid.safeParse(id);
  if (!p.success) return fail("invalid");
  const c = await ctx();
  if (!c) return fail("auth");
  const { data } = await c.supabase.from("couple_media").delete().eq("id", p.data).eq("author_id", c.uid).select("storage_path");
  if (!data?.length) return fail("forbidden");
  await c.supabase.storage.from("couple-media").remove(data.map((d) => d.storage_path));
  revalidatePath("/us/memories");
  return ok();
}

/* ───────── reactions ───────── */

/** One reaction: the quick set, a sticker (as "s:<n>"), or any pictographic emoji (with variation selectors / skin tones / joiners), at most 8 code points. */
const reactionEmoji = z.string().min(1).max(16)
  .refine((s) => [...s].length <= 8 && (/^\p{Extended_Pictographic}[\p{Extended_Pictographic}\uFE0F\u200D\p{Emoji_Modifier}]*$/u.test(s) || (REACTION_EMOJIS as readonly string[]).includes(s) || stickerFromReaction(s) !== null));

export async function toggleReactionAction(input: { targetType: "journal" | "media" | "little" | "story" | "song" | "joke" | "message"; targetId: string; emoji: string }) {
  const p = z.object({ targetType: z.enum(["journal", "media", "little", "story", "song", "joke", "message"]), targetId: uuid, emoji: reactionEmoji }).safeParse(input);
  if (!p.success) return fail("invalid");
  const c = await ctx();
  if (!c) return fail("auth");
  if (!rateLimit(`react:${c.uid}`, 60, 60_000)) return fail("rate");
  const { data: existing } = await c.supabase
    .from("reactions").select("id").eq("author_id", c.uid).eq("target_type", p.data.targetType).eq("target_id", p.data.targetId).eq("emoji", p.data.emoji).maybeSingle();
  if (existing) await c.supabase.from("reactions").delete().eq("id", existing.id);
  else await c.supabase.from("reactions").insert({ couple_id: c.couple.id, target_type: p.data.targetType, target_id: p.data.targetId, emoji: p.data.emoji });
  return ok();
}

/* ───────── little things ───────── */

export async function addLittleAction(input: { kind: string; body: string }) {
  const p = z.object({ kind: z.enum(LITTLE_KINDS), body: z.string().trim().min(1).max(600) }).safeParse(input);
  if (!p.success) return fail("invalid");
  const c = await ctx();
  if (!c) return fail("auth");
  if (!rateLimit(`little:${c.uid}`, 20, 60_000)) return fail("rate");
  const { error } = await c.supabase.from("little_things").insert({ couple_id: c.couple.id, kind: p.data.kind, body: p.data.body });
  if (error) return fail("generic");
  void pingPartner("little");
  revalidatePath("/us/little");
  return ok();
}

export async function answerLittleAction(input: { id: string; answer: string }) {
  const p = z.object({ id: uuid, answer: z.string().trim().min(1).max(600) }).safeParse(input);
  if (!p.success) return fail("invalid");
  const c = await ctx();
  if (!c) return fail("auth");
  await c.supabase.from("little_things").update({ answer: p.data.answer, opened_at: new Date().toISOString() }).eq("id", p.data.id);
  revalidatePath("/us/little");
  return ok();
}

export async function openLittleAction(id: string) {
  const p = uuid.safeParse(id);
  if (!p.success) return fail("invalid");
  const c = await ctx();
  if (!c) return fail("auth");
  await c.supabase.from("little_things").update({ opened_at: new Date().toISOString() }).eq("id", p.data).is("opened_at", null);
  revalidatePath("/us/little");
  return ok();
}

export async function deleteLittleAction(id: string) {
  const p = uuid.safeParse(id);
  if (!p.success) return fail("invalid");
  const c = await ctx();
  if (!c) return fail("auth");
  await c.supabase.from("little_things").delete().eq("id", p.data).eq("author_id", c.uid);
  revalidatePath("/us/little");
  return ok();
}

/* ───────── Refuge messages ("a message from him") ───────── */

export async function sendRefugeMessageAction(input: { body: string }) {
  const p = z.object({ body: z.string().trim().min(1).max(600) }).safeParse(input);
  if (!p.success) return fail("invalid");
  const c = await ctx();
  if (!c) return fail("auth");
  if (!c.couple.partner_id) return fail("forbidden");
  if (!rateLimit(`rmsg:${c.uid}`, 20, 60_000)) return fail("rate");
  const { error } = await c.supabase.from("refuge_messages").insert({ couple_id: c.couple.id, body: p.data.body });
  if (error) return fail("generic");
  void pingPartner("refuge");
  revalidatePath("/refuge/messages");
  return ok();
}

export async function openRefugeMessageAction(id: string) {
  const p = uuid.safeParse(id);
  if (!p.success) return fail("invalid");
  const c = await ctx();
  if (!c) return fail("auth");
  await c.supabase.from("refuge_messages").update({ opened_at: new Date().toISOString() }).eq("id", p.data).is("opened_at", null);
  return ok();
}

export async function deleteRefugeMessageAction(id: string) {
  const p = uuid.safeParse(id);
  if (!p.success) return fail("invalid");
  const c = await ctx();
  if (!c) return fail("auth");
  await c.supabase.from("refuge_messages").delete().eq("id", p.data).eq("author_id", c.uid);
  revalidatePath("/refuge/messages");
  return ok();
}

/* ───────── Vault ───────── */

export async function vaultSetPinAction(input: { pin: string; old?: string }) {
  const p = z.object({ pin: z.string().regex(/^\d{4,8}$/), old: z.string().regex(/^\d{4,8}$/).optional() }).safeParse(input);
  if (!p.success) return fail("invalid");
  const c = await ctx();
  if (!c) return fail("auth");
  const { error } = await c.supabase.rpc("vault_set_pin", { p_pin: p.data.pin, p_old: p.data.old ?? null });
  if (error) return fail(error.message.includes("locked") ? "locked" : error.message.includes("wrong_pin") ? "wrong_pin" : "generic");
  revalidatePath("/us/vault");
  return ok();
}

export async function vaultUnlockAction(pin: string) {
  const p = z.string().regex(/^\d{4,8}$/).safeParse(pin);
  if (!p.success) return fail("wrong_pin");
  const c = await ctx();
  if (!c) return fail("auth");
  const { data, error } = await c.supabase.rpc("vault_unlock", { p_pin: p.data });
  if (error) return fail("generic");
  const r = data as { ok: boolean; locked_until?: string };
  if (r.ok) { revalidatePath("/us/vault"); return ok(); }
  return fail(r.locked_until ? "locked" : "wrong_pin", { retryAt: r.locked_until });
}

export async function vaultLockAction() {
  const c = await ctx();
  if (!c) return fail("auth");
  await c.supabase.rpc("vault_lock");
  revalidatePath("/us/vault");
  return ok();
}

const vaultItem = z.object({
  kind: z.enum(["letter", "note", "photo"]),
  title: z.string().trim().max(120),
  body: z.string().trim().max(8000).optional(),
  path: z.string().max(300).optional(),
});

export async function addVaultItemAction(input: z.infer<typeof vaultItem>) {
  const p = vaultItem.safeParse(input);
  if (!p.success) return fail("invalid");
  const c = await ctx();
  if (!c) return fail("auth");
  if (!rateLimit(`vault:${c.uid}`, 30, 60_000)) return fail("rate");
  if (p.data.kind === "photo" && (!p.data.path || !p.data.path.startsWith(`${c.couple.id}/vault/`) || p.data.path.includes(".."))) return fail("forbidden");
  if (p.data.kind !== "photo" && !p.data.body) return fail("invalid");
  const { error } = await c.supabase.from("vault_items").insert({
    couple_id: c.couple.id, kind: p.data.kind, title: p.data.title, body: p.data.body || null, storage_path: p.data.kind === "photo" ? p.data.path : null,
  });
  if (error) return fail(error.code === "42501" ? "locked" : "generic");
  revalidatePath("/us/vault");
  return ok();
}

export async function deleteVaultItemAction(id: string) {
  const p = uuid.safeParse(id);
  if (!p.success) return fail("invalid");
  const c = await ctx();
  if (!c) return fail("auth");
  const { data } = await c.supabase.from("vault_items").delete().eq("id", p.data).eq("author_id", c.uid).select("storage_path");
  if (!data?.length) return fail("forbidden");
  const paths = data.map((d) => d.storage_path).filter(Boolean) as string[];
  if (paths.length) await c.supabase.storage.from("couple-media").remove(paths);
  revalidatePath("/us/vault");
  return ok();
}
