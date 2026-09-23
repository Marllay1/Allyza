import { PageHeader } from "@/components/ui";
import { SurprisesClient, type Received, type Sent } from "@/features/couple/surprises/SurprisesClient";
import { getT } from "@/lib/i18n/server";
import { getPartner } from "@/lib/nickname";
import { requireCouple } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function SurprisesPage() {
  const v = await requireCouple();
  const { t } = await getT();
  const supabase = await createClient();

  // Received surprises come ONLY through the database function that withholds sealed content.
  const [{ data: received }, { data: sent }, partner] = await Promise.all([
    supabase.rpc("my_surprises"),
    supabase.from("surprises").select("id, kind, unlock, unlock_at, created_at, opened_at, title, body, storage_path").order("created_at", { ascending: false }).limit(50),
    getPartner(),
  ]);

  return (
    <>
      <PageHeader title={t("couple.surprises")} subtitle={t("surprises.subtitle")} back="/us" backLabel={t("common.back")} />
      <SurprisesClient
        coupleId={v.couple.id}
        received={(received ?? []) as Received[]}
        sent={(sent ?? []) as Sent[]}
        otherName={partner?.name ?? t("couple.partnerFallback")}
        canSend={!!v.couple.partnerId}
      />
    </>
  );
}
