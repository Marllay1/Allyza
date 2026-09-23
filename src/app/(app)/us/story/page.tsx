import { PageHeader } from "@/components/ui";
import { StoryClient, type Moment } from "@/features/couple/story/StoryClient";
import { getT } from "@/lib/i18n/server";
import { getPartner } from "@/lib/nickname";
import { requireCouple } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Reaction } from "@/lib/use-reactions";

export default async function StoryPage() {
  const v = await requireCouple();
  const { t } = await getT();
  const supabase = await createClient();
  const [{ data: moments }, { data: reactions }] = await Promise.all([
    supabase.from("story_moments").select("id, author_id, moment_date, title, body, place, emotion, storage_path").order("moment_date", { ascending: false }).limit(300),
    supabase.from("reactions").select("id, target_type, target_id, emoji, author_id").eq("target_type", "story").limit(1000)
  ]);
  const other = (await getPartner())?.name ?? t("couple.partnerFallback");
  return (
    <>
      <PageHeader title={t("couple.story")} subtitle={t("story.subtitle")} back="/us" backLabel={t("common.back")} />
      <StoryClient coupleId={v.couple.id} myId={v.id} moments={(moments ?? []) as Moment[]} initialReactions={(reactions ?? []) as Reaction[]} names={{ me: t("common.you"), other }} />
    </>
  );
}
