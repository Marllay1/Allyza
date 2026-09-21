import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDays, toISODate, type DailyLog, type FoodLog, type Period } from "@/lib/cycle";
import type { Sharing } from "@/lib/constants";

/** Everything the "her" pages need. RLS guarantees it is only ever her own rows. */
export async function loadHerData(logDays = 180) {
  const supabase = await createClient();
  const since = addDays(toISODate(), -logDays);
  const [periods, logs, food, sharing] = await Promise.all([
    supabase.from("periods").select("id, start_date, end_date").order("start_date", { ascending: false }),
    supabase
      .from("daily_logs")
      .select("id, log_date, is_period, flow, pain, pain_type, pain_duration_min, fatigue, mood, sugar_level, symptoms, note")
      .gte("log_date", since)
      .order("log_date", { ascending: false }),
    supabase.from("food_logs").select("id, log_date, category, note").gte("log_date", since).order("created_at", { ascending: false }),
    supabase.from("sharing_settings").select("*").maybeSingle(),
  ]);
  return {
    periods: (periods.data ?? []) as Period[],
    logs: (logs.data ?? []) as DailyLog[],
    food: (food.data ?? []) as FoodLog[],
    sharing: (sharing.data ?? null) as (Sharing & { her_id: string }) | null,
  };
}
