import { ClientOnly } from "@/components/ClientOnly";
import { DayLogger } from "@/components/DayLogger";
import { PeriodManager } from "@/components/PeriodManager";
import { PageHeader, Section, Stat } from "@/components/ui";
import { computeStats } from "@/lib/cycle";
import { loadHerData } from "@/lib/her-data";
import { getT } from "@/lib/i18n/server";
import { requireHer } from "@/lib/session";

export default async function CyclePage() {
  await requireHer();
  const { t } = await getT();
  const { periods, logs } = await loadHerData();
  const s = computeStats(periods);
  return (
    <>
      <PageHeader title={t("her.cycle")} back="/her" backLabel={t("common.back")} />
      {s.avgCycle !== null && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Stat label={t("stats.avgCycleLabel")} value={t("common.daysShort", { n: s.avgCycle })} hint={t("stats.observedHint")} />
          <Stat label={t("stats.periodLength")} value={s.avgPeriod !== null ? t("common.daysShort", { n: s.avgPeriod }) : "–"} />
        </div>
      )}
      <Section title={t("cycle.periods")}>
        <ClientOnly>
          <PeriodManager periods={periods} />
        </ClientOnly>
      </Section>
      <Section title={t("cycle.dailyFlow")}>
        <ClientOnly>
          <DayLogger logs={logs} sections="period" />
        </ClientOnly>
      </Section>
    </>
  );
}
