"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fail, isoDate, ok, rateLimit, uuid } from "@/lib/action-utils";
import { FOOD_CATEGORIES, PAIN_TYPES, SYMPTOMS } from "@/lib/constants";

async function authed() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, uid: data.user?.id ?? null };
}
const done = () => {
  revalidatePath("/her", "layout");
  revalidatePath("/home");
  return ok();
};

/** Dates in the far future are almost certainly typos. Allow up to tomorrow for time zones. */
const notFuture = (d: string) => new Date(d + "T00:00:00Z").getTime() <= Date.now() + 2 * 86_400_000;
const dateField = isoDate.refine(notFuture);

const logSchema = z.object({
  date: dateField,
  is_period: z.boolean(),
  flow: z.number().int().min(1).max(4).nullable(),
  pain: z.number().int().min(0).max(10).nullable(),
  pain_type: z.enum(PAIN_TYPES).nullable(),
  pain_duration_min: z.number().int().min(0).max(1440).nullable(),
  fatigue: z.number().int().min(0).max(10).nullable(),
  mood: z.number().int().min(1).max(5).nullable(),
  sugar_level: z.enum(["low", "moderate", "high"]).nullable(),
  symptoms: z.array(z.enum(SYMPTOMS)).max(SYMPTOMS.length),
  note: z.string().trim().max(1000).nullable(),
});
export type DayLogInput = z.infer<typeof logSchema>;

export async function saveDayLogAction(input: DayLogInput) {
  const p = logSchema.safeParse(input);
  if (!p.success) return fail("invalid");
  const { supabase, uid } = await authed();
  if (!uid) return fail("auth");
  if (!rateLimit(`log:${uid}`, 60, 60_000)) return fail("rate");
  const d = p.data;
  const { error } = await supabase.from("daily_logs").upsert(
    {
      user_id: uid,
      log_date: d.date,
      is_period: d.is_period,
      flow: d.is_period ? d.flow : null,
      pain: d.pain,
      pain_type: d.pain === null ? null : d.pain_type,
      pain_duration_min: d.pain === null ? null : d.pain_duration_min,
      fatigue: d.fatigue,
      mood: d.mood,
      sugar_level: d.sugar_level,
      symptoms: d.symptoms,
      note: d.note || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,log_date" },
  );
  if (error) return fail("generic");
  return done();
}

export async function startPeriodAction(date: string) {
  const p = dateField.safeParse(date);
  if (!p.success) return fail("invalid");
  const { supabase, uid } = await authed();
  if (!uid) return fail("auth");
  const { error } = await supabase.from("periods").upsert({ user_id: uid, start_date: p.data }, { onConflict: "user_id,start_date", ignoreDuplicates: true });
  if (error) return fail("generic");
  await supabase.from("daily_logs").upsert({ user_id: uid, log_date: p.data, is_period: true }, { onConflict: "user_id,log_date", ignoreDuplicates: false });
  return done();
}

export async function endPeriodAction(input: { id: string; date: string }) {
  const p = z.object({ id: uuid, date: dateField }).safeParse(input);
  if (!p.success) return fail("invalid");
  const { supabase, uid } = await authed();
  if (!uid) return fail("auth");
  const { error } = await supabase.from("periods").update({ end_date: p.data.date }).eq("id", p.data.id).eq("user_id", uid);
  return error ? fail("invalid") : done();
}

export async function deletePeriodAction(id: string) {
  const p = uuid.safeParse(id);
  if (!p.success) return fail("invalid");
  const { supabase, uid } = await authed();
  if (!uid) return fail("auth");
  await supabase.from("periods").delete().eq("id", p.data).eq("user_id", uid);
  return done();
}

/** Bulk-add historical period start dates (e.g. imported from a paper diary). */
export async function addPastPeriodsAction(dates: string[]) {
  const p = z.array(dateField).min(1).max(60).safeParse(dates);
  if (!p.success) return fail("invalid");
  const { supabase, uid } = await authed();
  if (!uid) return fail("auth");
  const rows = [...new Set(p.data)].map((start_date) => ({ user_id: uid, start_date }));
  const { error } = await supabase.from("periods").upsert(rows, { onConflict: "user_id,start_date", ignoreDuplicates: true });
  return error ? fail("generic") : done();
}

export async function addFoodAction(input: { date: string; category: string; note?: string }) {
  const p = z
    .object({ date: dateField, category: z.enum(FOOD_CATEGORIES), note: z.string().trim().max(300).optional() })
    .safeParse(input);
  if (!p.success) return fail("invalid");
  const { supabase, uid } = await authed();
  if (!uid) return fail("auth");
  if (!rateLimit(`food:${uid}`, 60, 60_000)) return fail("rate");
  const { error } = await supabase
    .from("food_logs")
    .insert({ user_id: uid, log_date: p.data.date, category: p.data.category, note: p.data.note || null });
  return error ? fail("generic") : done();
}

export async function deleteFoodAction(id: string) {
  const p = uuid.safeParse(id);
  if (!p.success) return fail("invalid");
  const { supabase, uid } = await authed();
  if (!uid) return fail("auth");
  await supabase.from("food_logs").delete().eq("id", p.data).eq("user_id", uid);
  return done();
}

const sharingSchema = z
  .object({
    share_cycle_day: z.boolean(),
    share_period_status: z.boolean(),
    share_pain: z.boolean(),
    share_mood: z.boolean(),
    share_fatigue: z.boolean(),
    share_wellbeing: z.boolean(),
    share_food: z.boolean(),
    share_stats: z.boolean(),
  })
  .partial();

export async function updateSharingAction(input: z.infer<typeof sharingSchema>) {
  const p = sharingSchema.safeParse(input);
  if (!p.success) return fail("invalid");
  const { supabase, uid } = await authed();
  if (!uid) return fail("auth");
  const { error } = await supabase.from("sharing_settings").update(p.data).eq("her_id", uid);
  if (error) return fail("generic");
  revalidatePath("/settings", "layout");
  revalidatePath("/home");
  return ok();
}
