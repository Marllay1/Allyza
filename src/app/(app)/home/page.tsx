import { ClientOnly } from "@/components/ClientOnly";
import { Section } from "@/components/ui";
import { HomeHer } from "@/features/home/HomeHer";
import { PartnerHome } from "@/features/home/PartnerHome";
import { SHARING_KEYS } from "@/lib/constants";
import { loadHerData } from "@/lib/her-data";
import { getT } from "@/lib/i18n/server";
import { requireViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const v = await requireViewer();
  const { t } = await getT();
  const supabase = await createClient();

  // The couple is provisioned once (scripts/seed-users.mjs); nobody enters a code or picks a partner.
  const otherId = v.couple ? (v.role === "her" ? v.couple.partnerId : v.couple.herId) : null;
  const { data: other } = otherId ? await supabase.from("profiles").select("display_name").eq("id", otherId).maybeSingle() : { data: null };
  const otherName = other?.display_name || (v.role === "her" ? t("couple.partnerFallback") : t("partner.herFallback"));

  if (v.role === "partner") {
    return <PartnerHome myName={v.displayName} herName={otherName} />;
  }

  const { periods, logs, food, sharing } = await loadHerData(30);
  const sharedCount = sharing ? SHARING_KEYS.filter((k) => sharing[k]).length : 0;

  return (
    <ClientOnly fallback={<Section><p className="text-muted text-sm">{t("common.loading")}</p></Section>}>
      <HomeHer
        name={v.displayName}
        partnerName={otherName}
        periods={periods}
        logs={logs}
        food={food}
        sharedCount={sharedCount}
        hasPartner={!!v.couple?.partnerId}
        soft={v.prefs.soft_mode}
      />
    </ClientOnly>
  );
}
