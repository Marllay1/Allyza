import { ClientOnly } from "@/components/ClientOnly";
import { DayLogger } from "@/components/DayLogger";
import { PageHeader, Section } from "@/components/ui";
import { loadHerData } from "@/lib/her-data";
import { getT } from "@/lib/i18n/server";
import { requireHer } from "@/lib/session";

export default async function WellbeingPage() {
  await requireHer();
  const { t } = await getT();
  const { logs } = await loadHerData();
  return (
    <>
      <PageHeader title={t("her.wellbeing")} subtitle={t("wellbeing.subtitle")} back="/her" backLabel={t("common.back")} />
      <Section>
        <ClientOnly>
          <DayLogger logs={logs} sections="wellbeing" />
        </ClientOnly>
      </Section>
      <p className="text-xs text-muted text-center text-balance">{t("care.notMedical")}</p>
    </>
  );
}
