import { LittleClient, type Little } from "@/components/LittleClient";
import { PageHeader } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { getPartner } from "@/lib/nickname";
import { requireCouple } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Reaction } from "@/lib/use-reactions";

export default async function LittlePage() {
  const v = await requireCouple();
  const { t } = await getT();
  const supabase = await createClient();
  const [{ data: items }, { data: reactions }] = await Promise.all([
    supabase.from("little_things").select("id, author_id, kind, body, answer, opened_at, created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("reactions").select("id, target_type, target_id, emoji, author_id").eq("target_type", "little").limit(500)
  ]);
  const other = (await getPartner())?.name ?? t("couple.partnerFallback");
  return (
    <>
      <PageHeader title={t("couple.little")} subtitle={t("little.subtitle")} back="/us" backLabel={t("common.back")} />
      <LittleClient coupleId={v.couple.id} myId={v.id} items={(items ?? []) as Little[]} initialReactions={(reactions ?? []) as Reaction[]} names={{ me: t("common.you"), other }} />
    </>
  );
}
