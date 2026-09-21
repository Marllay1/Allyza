import { PageHeader } from "@/components/ui";
import { MusicClient, type Song } from "@/features/couple/music/MusicClient";
import { getT } from "@/lib/i18n/server";
import { requireCouple } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Reaction } from "@/lib/use-reactions";

export default async function MusicPage() {
  const v = await requireCouple();
  const { t } = await getT();
  const supabase = await createClient();
  const [{ data: songs }, { data: reactions }, { data: profiles }] = await Promise.all([
    supabase.from("shared_songs").select("id, author_id, title, artist, url, message, created_at").order("created_at", { ascending: false }).limit(200),
    supabase.from("reactions").select("id, target_type, target_id, emoji, author_id").eq("target_type", "song").limit(500),
    supabase.from("profiles").select("id, display_name"),
  ]);
  const otherId = v.id === v.couple.herId ? v.couple.partnerId : v.couple.herId;
  const other = profiles?.find((p) => p.id === otherId)?.display_name || t("couple.partnerFallback");
  return (
    <>
      <PageHeader title={t("couple.music")} subtitle={t("music.subtitle")} back="/us" backLabel={t("common.back")} />
      <MusicClient coupleId={v.couple.id} myId={v.id} songs={(songs ?? []) as Song[]} initialReactions={(reactions ?? []) as Reaction[]} names={{ me: t("common.you"), other }} />
    </>
  );
}
