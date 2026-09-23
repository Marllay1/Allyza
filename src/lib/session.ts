import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getAuthUser, getSupabase } from "@/lib/supabase/request";

export type Role = "her" | "partner";
export type Viewer = {
  id: string;
  role: Role;
  displayName: string;
  prefs: {
    locale: "fr" | "en";
    theme: "system" | "light" | "dark";
    soft_mode: boolean;
    notify_journal: boolean;
    notify_media: boolean;
    notify_refuge: boolean;
    notify_little: boolean;
    notify_surprise: boolean;
    notify_message: boolean;
  };
  couple: { id: string; herId: string; partnerId: string | null; inviteCode: string } | null;
};

/** The authoritative viewer, read from the database (never from client-supplied data). */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await getSupabase();
  const user = await getAuthUser();
  if (!user) return null;
  const uid = user.id;

  const [{ data: profile }, { data: prefs }, { data: couple }] = await Promise.all([
    supabase.from("profiles").select("id, role, display_name").eq("id", uid).maybeSingle(),
    supabase.from("user_preferences").select("*").eq("user_id", uid).maybeSingle(),
    supabase.from("couples").select("id, her_id, partner_id, invite_code").maybeSingle(),
  ]);
  if (!profile) return null;

  return {
    id: uid,
    role: profile.role as Role,
    displayName: profile.display_name,
    prefs: {
      locale: prefs?.locale ?? "fr",
      theme: prefs?.theme ?? "system",
      soft_mode: prefs?.soft_mode ?? false,
      notify_journal: prefs?.notify_journal ?? true,
      notify_media: prefs?.notify_media ?? true,
      notify_refuge: prefs?.notify_refuge ?? true,
      notify_little: prefs?.notify_little ?? true,
      notify_surprise: prefs?.notify_surprise ?? true,
      notify_message: prefs?.notify_message ?? true,
    },
    couple: couple
      ? { id: couple.id, herId: couple.her_id, partnerId: couple.partner_id, inviteCode: couple.invite_code }
      : null,
  };
});

export async function requireViewer(): Promise<Viewer> {
  const v = await getViewer();
  // Not "/login": a revoked-but-unexpired token would bounce between /login and /home forever.
  if (!v) redirect("/session-expired");
  return v;
}

/** Health tracking pages exist only for "her". The database enforces the same rule via RLS. */
export async function requireHer(): Promise<Viewer> {
  const v = await requireViewer();
  if (v.role !== "her") redirect("/home");
  return v;
}

/** Writing custom content for her exists only for the partner, and needs a linked couple. */
export async function requirePartner(): Promise<Viewer & { couple: NonNullable<Viewer["couple"]> }> {
  const v = await requireCouple();
  if (v.role !== "partner") redirect("/home");
  return v as Viewer & { couple: NonNullable<Viewer["couple"]> };
}

/** Couple pages need a linked couple. Her always has one; the partner only after joining. */
export async function requireCouple(): Promise<Viewer & { couple: NonNullable<Viewer["couple"]> }> {
  const v = await requireViewer();
  if (!v.couple) redirect("/home");
  return v as Viewer & { couple: NonNullable<Viewer["couple"]> };
}
