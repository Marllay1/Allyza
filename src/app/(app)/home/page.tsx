import { ClientOnly } from "@/components/ClientOnly";
import { Section } from "@/components/ui";
import { HomeHer } from "@/features/home/HomeHer";
import { PartnerHome } from "@/features/home/PartnerHome";
import { SHARING_KEYS } from "@/lib/constants";
import { loadHerData } from "@/lib/her-data";
import { getT } from "@/lib/i18n/server";
import { requireViewer } from "@/lib/session";
import { getSupabase } from "@/lib/supabase/request";

const EMPTY_HER = { periods: [], logs: [], food: [], sharing: null } as Awaited<ReturnType<typeof loadHerData>>;

export default async function HomePage() {
  const v = await requireViewer();
  const { t } = await getT();
  const supabase = await getSupabase();

  // The couple is provisioned once (scripts/seed-users.mjs); nobody enters a code or picks a partner.
  const otherId = v.couple ? (v.role === "her" ? v.couple.partnerId : v.couple.herId) : null;

  // Independent queries run together: one round-trip's worth of waiting instead of two.
  const [{ data: other }, her] = await Promise.all([
    otherId ? supabase.from("profiles").select("display_name").eq("id", otherId).maybeSingle() : Promise.resolve({ data: null }),
    v.role === "her" ? loadHerData(30) : Promise.resolve(EMPTY_HER),
  ]);
  const otherName = other?.display_name || (v.role === "her" ? t("couple.partnerFallback") : t("partner.herFallback"));

  if (v.role === "partner") return <PartnerHome myName={v.displayName} herName={otherName} />;

  const sharedCount = her.sharing ? SHARING_KEYS.filter((k) => her.sharing![k]).length : 0;
  return (
    <ClientOnly fallback={<Section><p className="text-muted text-sm">{t("common.loading")}</p></Section>}>
      <HomeHer
        name={v.displayName}
        partnerName={otherName}
        periods={her.periods}
        logs={her.logs}
        food={her.food}
        sharedCount={sharedCount}
        hasPartner={!!v.couple?.partnerId}
        soft={v.prefs.soft_mode}
      />
    </ClientOnly>
  );
}
