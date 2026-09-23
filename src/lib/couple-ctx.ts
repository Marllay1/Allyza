import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/request";

/** Verified user + their couple, read from the database (never from client input). The user id
 * itself is never re-checked against Supabase here — proxy.ts already verified this request's
 * session once and forwards the result, so every action just reads that instead of paying for
 * its own auth round-trip. */
export async function coupleCtx() {
  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) return null;
  const { data: couple } = await supabase.from("couples").select("id, her_id, partner_id").maybeSingle();
  if (!couple) return null;
  return { supabase, uid: user.id, couple };
}
