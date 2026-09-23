import "server-only";
import { cache } from "react";
import { getT } from "@/lib/i18n/server";
import { getViewer } from "@/lib/session";
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

export type Partner = {
  id: string;
  /** What the viewer calls them: their own nickname for the partner, else the partner's profile name. */
  name: string;
  /** The partner's real profile name (the default, before any nickname). */
  displayName: string;
  avatarPath: string | null;
  tone: "rose" | "gold";
};

/**
 * THE partner resolver. Every screen that names the other person must come through here, so
 * changing the nickname in Settings changes the whole app. Default names are the two profile
 * names (Llayane ↔ Alhanouzzia); "Your partner" only appears if the profile itself is missing.
 */
export const getPartner = cache(async (): Promise<Partner | null> => {
  const v = await getViewer();
  if (!v?.couple) return null;
  const id = v.role === "her" ? v.couple.partnerId : v.couple.herId;
  if (!id) return null;
  const supabase = await getSupabase();
  const [{ t }, { data: profile }] = await Promise.all([
    getT(),
    supabase.from("profiles").select("display_name, avatar_path").eq("id", id).maybeSingle(),
  ]);
  const displayName = profile?.display_name || t("couple.partnerFallback");
  const name = await getMyNicknameForPartner(id, displayName);
  return { id, name, displayName, avatarPath: profile?.avatar_path ?? null, tone: v.role === "her" ? "gold" : "rose" };
});
