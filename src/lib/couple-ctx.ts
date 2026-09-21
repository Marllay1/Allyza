import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Verified user + their couple, read from the database (never from client input). */
export async function coupleCtx() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: couple } = await supabase.from("couples").select("id, her_id, partner_id").maybeSingle();
  if (!couple) return null;
  return { supabase, uid: auth.user.id, couple };
}
