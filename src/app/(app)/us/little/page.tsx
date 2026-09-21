import { LittleClient, type Little } from "@/components/LittleClient";
import { PageHeader } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { requireCouple } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Reaction } from "@/lib/use-reactions";

export default async function LittlePage() {
  const v = await requireCouple();
  const { t } = await getT();
  const supabase = await createClient();
  const [{ data: items }, { data: reactions }, { data: profiles }] = await Promise.all([
    supabase.from("little_things").select("id, author_id, kind, body, answer, opened_at, created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("reactions").select("id, target_type, target_id, emoji, author_id").eq("target_type", "little").limit(500),
    supabase.from("profiles").select("id, display_name"),
  ]);
  const otherId = v.id === v.couple.herId ? v.couple.partnerId : v.couple.herId;
  const other = profiles?.find((p) => p.id === otherId)?.display_name || t("couple.partnerFallback");
  return (
    <>
      <PageHeader title={t("couple.little")} subtitle={t("little.subtitle")} back="/us" backLabel={t("common.back")} />
      <LittleClient coupleId={v.couple.id} myId={v.id} items={(items ?? []) as Little[]} initialReactions={(reactions ?? []) as Reaction[]} names={{ me: t("common.you"), other }} />
    </>
  );
}
