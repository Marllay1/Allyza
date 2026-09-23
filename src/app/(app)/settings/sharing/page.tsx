import { SharingForm } from "@/components/SettingsForms";
import { PageHeader } from "@/components/ui";
import { SHARING_KEYS, type Sharing } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";
import { getPartner } from "@/lib/nickname";
import { requireHer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function SharingPage() {
  const v = await requireHer();
  const { t } = await getT();
  const supabase = await createClient();
  const name = (await getPartner())?.name ?? t("couple.partnerFallback");
  const { data } = await supabase.from("sharing_settings").select("*").maybeSingle();
  const initial = Object.fromEntries(SHARING_KEYS.map((k) => [k, !!data?.[k]])) as Sharing;
  return (
    <>
      <PageHeader title={t("settings.sharing")} subtitle={t("sharing.subtitle", { name })} back="/settings" backLabel={t("common.back")} />
      <SharingForm initial={initial} herPartnerLinked={!!v.couple?.partnerId} partnerName={name} />
      <p className="text-xs text-muted text-center mt-6 text-balance">{t("sharing.footer", { name })}</p>
    </>
  );
}
