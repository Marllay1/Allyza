import { PageHeader } from "@/components/ui";
import { MusicClient, type Song } from "@/features/couple/music/MusicClient";
import { getT } from "@/lib/i18n/server";
import { getPartner } from "@/lib/nickname";
import { requireCouple } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Reaction } from "@/lib/use-reactions";

export default async function MusicPage() {
  const v = await requireCouple();
  const { t } = await getT();
  const supabase = await createClient();
  const [{ data: songs }, { data: reactions }] = await Promise.all([
    supabase.from("shared_songs").select("id, author_id, title, artist, url, message, created_at").order("created_at", { ascending: false }).limit(200),
    supabase.from("reactions").select("id, target_type, target_id, emoji, author_id").eq("target_type", "song").limit(500)
  ]);
  const other = (await getPartner())?.name ?? t("couple.partnerFallback");
  return (
    <>
      <PageHeader title={t("couple.music")} subtitle={t("music.subtitle")} back="/us" backLabel={t("common.back")} />
      <MusicClient coupleId={v.couple.id} myId={v.id} songs={(songs ?? []) as Song[]} initialReactions={(reactions ?? []) as Reaction[]} names={{ me: t("common.you"), other }} />
    </>
  );
}
