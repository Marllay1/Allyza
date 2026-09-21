import { ClientOnly } from "@/components/ClientOnly";
import { HerDashboard } from "@/components/HerDashboard";
import { InviteCard, JoinCard } from "@/components/LinkCards";
import { PartnerHome } from "@/components/PartnerHome";
import { Section } from "@/components/ui";
import { SHARING_KEYS } from "@/lib/constants";
import { loadHerData } from "@/lib/her-data";
import { getT } from "@/lib/i18n/server";
import { requireViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const v = await requireViewer();
  const { t } = await getT();

  if (v.role === "partner") {
    if (!v.couple?.partnerId) {
      return (
        <>
          <h1 className="text-4xl mb-5">{t("link.welcomePartner", { name: v.displayName })}</h1>
          <Section><JoinCard /></Section>
        </>
      );
    }
    const supabase = await createClient();
    const { data: her } = await supabase.from("profiles").select("display_name").eq("id", v.couple.herId).maybeSingle();
    return <PartnerHome herName={her?.display_name || t("partner.herFallback")} />;
  }

  const { periods, logs, food, sharing } = await loadHerData(30);
  const sharedCount = sharing ? SHARING_KEYS.filter((k) => sharing[k]).length : 0;
  const linked = !!v.couple?.partnerId;

  return (
    <>
      <ClientOnly>
        <HerDashboard
          name={v.displayName}
          periods={periods}
          logs={logs}
          food={food}
          sharedCount={sharedCount}
          hasPartner={linked}
          soft={v.prefs.soft_mode}
        />
      </ClientOnly>
      {!linked && v.couple && (
        <Section title={t("link.inviteTitle")}>
          <InviteCard code={v.couple.inviteCode} linked={false} />
        </Section>
      )}
    </>
  );
}
