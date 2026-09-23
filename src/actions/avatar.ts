"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, rateLimit } from "@/lib/action-utils";
import { coupleCtx } from "@/lib/couple-ctx";

/** Called after the browser uploaded the photo to the private bucket (path is verified here). */
export async function setAvatarAction(path: string) {
  const p = z.string().min(10).max(300).safeParse(path);
  if (!p.success) return fail("invalid");
  const c = await coupleCtx();
  if (!c) return fail("auth");
  if (!rateLimit(`avatar:${c.uid}`, 10, 60_000)) return fail("rate");
  if (!p.data.startsWith(`${c.couple.id}/avatars/`) || p.data.includes("..")) return fail("forbidden");
  const { data: prev } = await c.supabase.from("profiles").select("avatar_path").eq("id", c.uid).single();
  const { error } = await c.supabase.from("profiles").update({ avatar_path: p.data }).eq("id", c.uid);
  if (error) {
    await c.supabase.storage.from("couple-media").remove([p.data]);
    return fail("generic");
  }
  if (prev?.avatar_path && prev.avatar_path !== p.data) await c.supabase.storage.from("couple-media").remove([prev.avatar_path]);
  revalidatePath("/", "layout");
  return ok();
}

export async function removeAvatarAction() {
  const c = await coupleCtx();
  if (!c) return fail("auth");
  const { data: prev } = await c.supabase.from("profiles").select("avatar_path").eq("id", c.uid).single();
  await c.supabase.from("profiles").update({ avatar_path: null }).eq("id", c.uid);
  if (prev?.avatar_path) await c.supabase.storage.from("couple-media").remove([prev.avatar_path]);
  revalidatePath("/", "layout");
  return ok();
}
