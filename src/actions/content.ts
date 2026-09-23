"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, rateLimit, uuid } from "@/lib/action-utils";
import { coupleCtx } from "@/lib/couple-ctx";
import { CUSTOM_CONTENT_CATEGORIES } from "@/lib/constants";

const bodyField = z.string().trim().min(1).max(4000);
const titleField = z.string().trim().max(120).optional();

const createSchema = z.object({
  category: z.enum(CUSTOM_CONTENT_CATEGORIES),
  title: titleField,
  body: bodyField,
  storagePath: z.string().min(10).max(300).optional(),
  status: z.enum(["draft", "scheduled", "published"]),
  publishAt: z.string().datetime().optional(),
});

const okPath = (path: string, coupleId: string) => path.startsWith(`${coupleId}/`) && !path.includes("..") && path.length < 300;

export async function createContentAction(input: z.infer<typeof createSchema>) {
  const p = createSchema.safeParse(input);
  if (!p.success) return fail("invalid");
  if (p.data.status === "scheduled" && !p.data.publishAt) return fail("invalid");
  const c = await coupleCtx();
  if (!c) return fail("auth");
  if (!rateLimit(`content:${c.uid}`, 40, 60_000)) return fail("rate");
  if (p.data.storagePath && !okPath(p.data.storagePath, c.couple.id)) return fail("forbidden");
  const { data, error } = await c.supabase
    .from("custom_content")
    .insert({
      couple_id: c.couple.id,
      category: p.data.category,
      title: p.data.title || null,
      body: p.data.body,
      storage_path: p.data.storagePath ?? null,
      status: p.data.status,
      publish_at: p.data.status === "scheduled" ? p.data.publishAt : null,
    })
    .select("id, author_id, category, title, body, storage_path, status, publish_at, created_at, updated_at")
    .single();
  if (error || !data) return fail("generic");
  revalidatePath("/home");
  return ok(data);
}

const updateSchema = z.object({
  id: uuid,
  category: z.enum(CUSTOM_CONTENT_CATEGORIES),
  title: titleField,
  body: bodyField,
  status: z.enum(["draft", "scheduled", "published"]),
  publishAt: z.string().datetime().optional(),
});

export async function updateContentAction(input: z.infer<typeof updateSchema>) {
  const p = updateSchema.safeParse(input);
  if (!p.success) return fail("invalid");
  if (p.data.status === "scheduled" && !p.data.publishAt) return fail("invalid");
  const c = await coupleCtx();
  if (!c) return fail("auth");
  const { error } = await c.supabase
    .from("custom_content")
    .update({
      category: p.data.category,
      title: p.data.title || null,
      body: p.data.body,
      status: p.data.status,
      publish_at: p.data.status === "scheduled" ? p.data.publishAt : null,
    })
    .eq("id", p.data.id).eq("author_id", c.uid);
  if (error) return fail("generic");
  revalidatePath("/home");
  return ok();
}

export async function deleteContentAction(id: string) {
  const p = uuid.safeParse(id);
  if (!p.success) return fail("invalid");
  const c = await coupleCtx();
  if (!c) return fail("auth");
  const { data, error } = await c.supabase.from("custom_content").select("storage_path").eq("id", p.data).eq("author_id", c.uid).single();
  if (error || !data) return fail("forbidden");
  const { error: e2 } = await c.supabase.from("custom_content").delete().eq("id", p.data).eq("author_id", c.uid);
  if (e2) return fail("generic");
  if (data.storage_path) await c.supabase.storage.from("couple-media").remove([data.storage_path]);
  revalidatePath("/home");
  return ok();
}
