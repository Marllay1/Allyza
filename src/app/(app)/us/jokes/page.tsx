import { PageHeader } from "@/components/ui";
import { JokesClient, type Joke } from "@/features/couple/jokes/JokesClient";
import { getT } from "@/lib/i18n/server";
import { getPartner } from "@/lib/nickname";
import { requireCouple } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Reaction } from "@/lib/use-reactions";

export default async function JokesPage() {
  const v = await requireCouple();
  const { t } = await getT();
  const supabase = await createClient();
  const [{ data: jokes }, { data: reactions }] = await Promise.all([
    supabase.from("inside_jokes").select("id, author_id, kind, body, note").order("created_at", { ascending: false }).limit(200),
    supabase.from("reactions").select("id, target_type, target_id, emoji, author_id").eq("target_type", "joke").limit(500)
  ]);
  const other = (await getPartner())?.name ?? t("couple.partnerFallback");
  return (
    <>
      <PageHeader title={t("couple.jokes")} subtitle={t("jokes.subtitle")} back="/us" backLabel={t("common.back")} />
      <JokesClient coupleId={v.couple.id} myId={v.id} jokes={(jokes ?? []) as Joke[]} initialReactions={(reactions ?? []) as Reaction[]} names={{ me: t("common.you"), other }} />
    </>
  );
}
