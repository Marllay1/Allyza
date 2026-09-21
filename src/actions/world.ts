"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, isoDate, ok, rateLimit, uuid } from "@/lib/action-utils";
import { CHECKIN_STATES, JOKE_KINDS, STORY_EMOTIONS, SURPRISE_KINDS, SURPRISE_UNLOCKS } from "@/lib/constants";
import { coupleCtx } from "@/lib/couple-ctx";
import { getT } from "@/lib/i18n/server";
import { pingPartner } from "@/lib/push";

const okPath = (path: string, coupleId: string) =>
  path.startsWith(`${coupleId}/`) && path.split("/")[1] !== "vault" && !path.includes("..") && path.length < 300;

/* ───────── "How are you, really?" (her own health data, saved only when she confirms) ───────── */

export async function quickCheckinAction(input: { date: string; state: string }) {
  const p = z.object({ date: isoDate, state: z.enum(CHECKIN_STATES) }).safeParse(input);
  if (!p.success) return fail("invalid");
  const c = await coupleCtx();
  if (!c) return fail("auth");
  if (!rateLimit(`checkin:${c.uid}`, 30, 60_000)) return fail("rate");
  // Only the fields this answer implies are written; everything else already logged that day is kept.
  const patch = { good: { mood: 4 }, ok: { mood: 3 }, tired: { fatigue: 7 }, love: { mood: 2 } }[p.data.state];
  const { error } = await c.supabase.from("daily_logs").upsert({ user_id: c.uid, log_date: p.data.date, ...patch }, { onConflict: "user_id,log_date" });
  if (error) return fail("generic");
  revalidatePath("/home");
  revalidatePath("/her", "layout");
  return ok();
}

/** Explicit, opt-in: she chooses to tell him she needs a little love. */
export async function askForLoveAction() {
  const c = await coupleCtx();
  if (!c || !c.couple.partner_id) return fail("auth");
  if (!rateLimit(`love:${c.uid}`, 5, 60 * 60_000)) return fail("rate");
  const { t } = await getT();
  const { error } = await c.supabase.from("refuge_messages").insert({ couple_id: c.couple.id, body: t("checkin.loveMessage") });
  if (error) return fail("generic");
  void pingPartner("refuge");
  return ok();
}

/* ───────── surprises ───────── */

const surpriseInput = z.object({
  kind: z.enum(SURPRISE_KINDS),
  title: z.string().trim().max(80),
  body: z.string().trim().min(1).max(2000),
  unlock: z.enum(SURPRISE_UNLOCKS),
  unlockAt: z.string().datetime({ offset: true }).optional(),
  path: z.string().optional(),
});

export async function createSurpriseAction(input: z.infer<typeof surpriseInput>) {
  const p = surpriseInput.safeParse(input);
  if (!p.success) return fail("invalid");
  const c = await coupleCtx();
  if (!c) return fail("auth");
  if (!c.couple.partner_id) return fail("forbidden");
  if (!rateLimit(`surprise:${c.uid}`, 20, 60_000)) return fail("rate");
  const dated = ["tonight", "tomorrow", "date"].includes(p.data.unlock);
  if (dated && !p.data.unlockAt) return fail("invalid");
  if (p.data.unlockAt && new Date(p.data.unlockAt).getTime() > Date.now() + 5 * 365 * 86_400_000) return fail("invalid");
  if (p.data.path && !okPath(p.data.path, c.couple.id)) return fail("forbidden");
  const { error } = await c.supabase.from("surprises").insert({
    couple_id: c.couple.id, kind: p.data.kind, title: p.data.title, body: p.data.body,
    unlock: p.data.unlock, unlock_at: dated ? p.data.unlockAt : null, storage_path: p.data.path ?? null,
  });
  if (error) {
    if (p.data.path) await c.supabase.storage.from("couple-media").remove([p.data.path]);
    return fail("generic");
  }
  void pingPartner("surprise");
  revalidatePath("/us/surprises");
  return ok();
}

/** Reveals the content (the database refuses if the date has not arrived). */
export async function openSurpriseAction(id: string) {
  const p = uuid.safeParse(id);
  if (!p.success) return fail("invalid");
  const c = await coupleCtx();
  if (!c) return fail("auth");
  const { data, error } = await c.supabase.rpc("open_surprise", { p_id: p.data });
  if (error) return fail(error.message.includes("locked") ? "locked" : "not_found");
  revalidatePath("/us/surprises");
  return ok(data as { kind: string; title: string; body: string; storage_path: string | null });
}

export async function deleteSurpriseAction(id: string) {
  const p = uuid.safeParse(id);
  if (!p.success) return fail("invalid");
  const c = await coupleCtx();
  if (!c) return fail("auth");
  const { data } = await c.supabase.from("surprises").delete().eq("id", p.data).eq("author_id", c.uid).select("storage_path");
  if (!data?.length) return fail("forbidden");
  const paths = data.map((d) => d.storage_path).filter(Boolean) as string[];
  if (paths.length) await c.supabase.storage.from("couple-media").remove(paths);
  revalidatePath("/us/surprises");
  return ok();
}

/* ───────── our story ───────── */

const storyInput = z.object({
  date: isoDate,
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().max(3000).optional(),
  place: z.string().trim().max(120).optional(),
  emotion: z.enum(STORY_EMOTIONS).optional(),
  path: z.string().optional(),
});

export async function addStoryAction(input: z.infer<typeof storyInput>) {
  const p = storyInput.safeParse(input);
  if (!p.success) return fail("invalid");
  const c = await coupleCtx();
  if (!c) return fail("auth");
  if (!rateLimit(`story:${c.uid}`, 30, 60_000)) return fail("rate");
  if (p.data.path && !okPath(p.data.path, c.couple.id)) return fail("forbidden");
  const { error } = await c.supabase.from("story_moments").insert({
    couple_id: c.couple.id, moment_date: p.data.date, title: p.data.title, body: p.data.body || null,
    place: p.data.place || null, emotion: p.data.emotion ?? null, storage_path: p.data.path ?? null,
  });
  if (error) {
    if (p.data.path) await c.supabase.storage.from("couple-media").remove([p.data.path]);
    return fail("generic");
  }
  revalidatePath("/us", "layout");
  return ok();
}

export async function deleteStoryAction(id: string) {
  const p = uuid.safeParse(id);
  if (!p.success) return fail("invalid");
  const c = await coupleCtx();
  if (!c) return fail("auth");
  const { data } = await c.supabase.from("story_moments").delete().eq("id", p.data).eq("author_id", c.uid).select("storage_path");
  if (!data?.length) return fail("forbidden");
  const paths = data.map((d) => d.storage_path).filter(Boolean) as string[];
  if (paths.length) await c.supabase.storage.from("couple-media").remove(paths);
  revalidatePath("/us", "layout");
  return ok();
}

/* ───────── inside jokes ───────── */

export async function addJokeAction(input: { kind: string; body: string; note?: string }) {
  const p = z.object({ kind: z.enum(JOKE_KINDS), body: z.string().trim().min(1).max(500), note: z.string().trim().max(500).optional() }).safeParse(input);
  if (!p.success) return fail("invalid");
  const c = await coupleCtx();
  if (!c) return fail("auth");
  if (!rateLimit(`joke:${c.uid}`, 30, 60_000)) return fail("rate");
  const { error } = await c.supabase.from("inside_jokes").insert({ couple_id: c.couple.id, kind: p.data.kind, body: p.data.body, note: p.data.note || null });
  if (error) return fail("generic");
  revalidatePath("/us/jokes");
  return ok();
}

export async function deleteJokeAction(id: string) {
  const p = uuid.safeParse(id);
  if (!p.success) return fail("invalid");
  const c = await coupleCtx();
  if (!c) return fail("auth");
  await c.supabase.from("inside_jokes").delete().eq("id", p.data).eq("author_id", c.uid);
  revalidatePath("/us/jokes");
  return ok();
}

/* ───────── songs ───────── */

const httpUrl = z.string().trim().max(500).url().refine((u) => /^https?:\/\//i.test(u));

export async function addSongAction(input: { title: string; artist: string; url?: string; message?: string }) {
  const p = z.object({
    title: z.string().trim().min(1).max(120), artist: z.string().trim().min(1).max(120),
    url: z.union([httpUrl, z.literal("")]).optional(), message: z.string().trim().max(500).optional(),
  }).safeParse(input);
  if (!p.success) return fail("invalid");
  const c = await coupleCtx();
  if (!c) return fail("auth");
  if (!rateLimit(`song:${c.uid}`, 20, 60_000)) return fail("rate");
  const { error } = await c.supabase.from("shared_songs").insert({
    couple_id: c.couple.id, title: p.data.title, artist: p.data.artist, url: p.data.url || null, message: p.data.message || null,
  });
  if (error) return fail("generic");
  revalidatePath("/us/music");
  return ok();
}

export async function deleteSongAction(id: string) {
  const p = uuid.safeParse(id);
  if (!p.success) return fail("invalid");
  const c = await coupleCtx();
  if (!c) return fail("auth");
  await c.supabase.from("shared_songs").delete().eq("id", p.data).eq("author_id", c.uid);
  revalidatePath("/us/music");
  return ok();
}
