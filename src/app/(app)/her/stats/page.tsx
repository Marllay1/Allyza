import { Bars, LineChart } from "@/components/charts";
import { Notice } from "@/components/Feedback";
import { PageHeader, Section, Stat } from "@/components/ui";
import {
  MIN_CYCLES_FOR_STATS, MIN_LOGS_FOR_TRENDS, computeStats, foodPattern, series, sugarPattern, trendDirection,
} from "@/lib/cycle";
import { formatDay } from "@/lib/format";
import { loadHerData } from "@/lib/her-data";
import { getT } from "@/lib/i18n/server";
import { requireHer } from "@/lib/session";

export default async function StatsPage() {
  await requireHer();
  const { t, locale } = await getT();
  const { periods, logs, food } = await loadHerData(180);
  const s = computeStats(periods);
  const enoughCycles = s.cycleCount >= MIN_CYCLES_FOR_STATS;

  const trends = (["pain", "fatigue", "mood"] as const).map((f) => {
    const pts = series(logs, f, 60);
    return { f, pts, dir: trendDirection(pts) };
  });
  const enoughLogs = trends.some((x) => x.pts.length >= MIN_LOGS_FOR_TRENDS);
  const sugar = sugarPattern(logs, 60);
  const foodP = foodPattern(food, 30);
  const foodRows = Object.entries(foodP).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: t(`food.cat.${k as "fruit"}`), value: v }));

  return (
    <>
      <PageHeader title={t("her.stats")} subtitle={t("stats.subtitle")} back="/her" backLabel={t("common.back")} />

      <Notice>{t("stats.observationNote")}</Notice>
      <div className="h-4" />

      <Section title={t("stats.cyclesTitle")}>
        {!enoughCycles ? (
          <p className="text-sm text-muted">{t("stats.needCycles", { n: MIN_CYCLES_FOR_STATS, have: s.cycleCount })}</p>
        ) : (
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Stat label={t("stats.avgCycleLabel")} value={t("common.daysShort", { n: s.avgCycle! })} hint={t("stats.observedHint")} />
              <Stat label={t("stats.range")} value={`${s.minCycle}–${s.maxCycle}`} hint={t("common.daysUnit")} />
              <Stat label={t("stats.variability")} value={s.variability !== null ? `±${s.variability}` : "–"} hint={t("common.daysUnit")} />
              <Stat label={t("stats.periodLength")} value={s.avgPeriod !== null ? `${s.avgPeriod}` : "–"} hint={t("common.daysUnit")} />
            </div>
            <p className="text-sm text-muted">{t("stats.observedAvg", { n: s.avgCycle! })}. {t("stats.notFixed")}</p>
            <Bars
              rows={s.lengths.slice(-8).map((l) => ({ label: formatDay(l.start, locale, { day: "numeric", month: "short" }), value: l.days }))}
              unit={` ${t("common.daysUnit")}`}
            />
          </div>
        )}
      </Section>

      <Section title={t("stats.trendsTitle")}>
        {!enoughLogs ? (
          <p className="text-sm text-muted">{t("stats.needLogs", { n: MIN_LOGS_FOR_TRENDS })}</p>
        ) : (
          <div className="grid gap-5">
            {trends.map(({ f, pts, dir }) => (
              <div key={f}>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-xl">{t(`wellbeing.${f}`)}</h3>
                  {dir && <span className="text-xs text-muted">{t(`stats.trend.${dir}`)}</span>}
                </div>
                <LineChart
                  points={pts} min={f === "mood" ? 1 : 0} max={f === "mood" ? 5 : 10}
                  color={f === "pain" ? "var(--rose)" : f === "fatigue" ? "var(--mauve)" : "var(--accent)"}
                  label={t(`wellbeing.${f}`)}
                />
              </div>
            ))}
            <p className="text-sm text-muted">{t("stats.patternsAppear")}</p>
          </div>
        )}
      </Section>

      <Section title={t("stats.foodTitle")}>
        {foodRows.length === 0 && sugar.total === 0 ? (
          <p className="text-sm text-muted">{t("stats.needFood")}</p>
        ) : (
          <div className="grid gap-5">
            {foodRows.length > 0 && <Bars rows={foodRows} color="var(--good)" />}
            {sugar.total > 0 && (
              <div>
                <h3 className="text-xl mb-2">{t("food.sugarToday")}</h3>
                <Bars
                  rows={[
                    { label: t("food.sugar.low"), value: sugar.low },
                    { label: t("food.sugar.moderate"), value: sugar.moderate },
                    { label: t("food.sugar.high"), value: sugar.high },
                  ]}
                  color="var(--gold)"
                />
              </div>
            )}
            <p className="text-sm text-muted">{t("stats.noCausation")}</p>
          </div>
        )}
      </Section>
      <p className="text-xs text-muted text-center text-balance">{t("care.notMedical")}</p>
    </>
  );
}
