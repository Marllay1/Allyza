import { PageHeader } from "@/components/ui";
import { StoryClient, type Moment } from "@/features/couple/story/StoryClient";
import { getT } from "@/lib/i18n/server";
import { requireCouple } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Reaction } from "@/lib/use-reactions";

export default async function StoryPage() {
  const v = await requireCouple();
  const { t } = await getT();
  const supabase = await createClient();
  const [{ data: moments }, { data: reactions }, { data: profiles }] = await Promise.all([
    supabase.from("story_moments").select("id, author_id, moment_date, title, body, place, emotion, storage_path").order("moment_date", { ascending: false }).limit(300),
    supabase.from("reactions").select("id, target_type, target_id, emoji, author_id").eq("target_type", "story").limit(1000),
    supabase.from("profiles").select("id, display_name"),
  ]);
  const otherId = v.id === v.couple.herId ? v.couple.partnerId : v.couple.herId;
  const other = profiles?.find((p) => p.id === otherId)?.display_name || t("couple.partnerFallback");
  return (
    <>
      <PageHeader title={t("couple.story")} subtitle={t("story.subtitle")} back="/us" backLabel={t("common.back")} />
      <StoryClient coupleId={v.couple.id} myId={v.id} moments={(moments ?? []) as Moment[]} initialReactions={(reactions ?? []) as Reaction[]} names={{ me: t("common.you"), other }} />
    </>
  );
}
