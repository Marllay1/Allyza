import "server-only";
import { cache } from "react";
import { getSupabase } from "@/lib/supabase/request";

/**
 * "What I call the other person" — set once in Settings, private to the person who set it.
 * She can call him "Mon amour" while he calls her "Alhanou"; neither sees the other's choice,
 * and every screen that names the partner reads through this instead of their profile name.
 */
export const getMyNicknameForPartner = cache(async (partnerId: string | null | undefined, fallback: string): Promise<string> => {
  if (!partnerId) return fallback;
  const supabase = await getSupabase();
  const { data } = await supabase.from("nicknames").select("nickname").eq("target_id", partnerId).maybeSingle();
  return data?.nickname || fallback;
});
