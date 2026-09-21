import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Downloads her own health data as JSON (RLS guarantees only her rows can ever be returned). */
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new NextResponse(null, { status: 401 });

  const [periods, logs, food, sharing] = await Promise.all([
    supabase.from("periods").select("start_date, end_date").order("start_date"),
    supabase.from("daily_logs").select("log_date, is_period, flow, pain, pain_type, pain_duration_min, fatigue, mood, sugar_level, symptoms, note").order("log_date"),
    supabase.from("food_logs").select("log_date, category, note").order("log_date"),
    supabase.from("sharing_settings").select("*").maybeSingle(),
  ]);
  const body = JSON.stringify({ exportedAt: new Date().toISOString(), periods: periods.data, dailyLogs: logs.data, foodLogs: food.data, sharing: sharing.data }, null, 2);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="allyza-export.json"',
      "Cache-Control": "private, no-store",
    },
  });
}
