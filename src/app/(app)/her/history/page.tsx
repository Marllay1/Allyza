import { AppIcon } from "@/components/icons";
import { Empty, PageHeader, Section } from "@/components/ui";
import { daysBetween, sleepDurationMin, type DailyLog } from "@/lib/cycle";
import { formatDay } from "@/lib/format";
import { loadHerData } from "@/lib/her-data";
import { getT } from "@/lib/i18n/server";
import { MOOD_TAG_ICON, type MoodTag } from "@/lib/mood";
import { requireHer } from "@/lib/session";

export default async function HistoryPage() {
  await requireHer();
  const { t, locale } = await getT();
  const { periods, logs, food } = await loadHerData(365);
  const foodByDay = new Map<string, number>();
  food.forEach((f) => foodByDay.set(f.log_date, (foodByDay.get(f.log_date) ?? 0) + 1));

  const hasContent = (l: DailyLog) =>
    l.is_period || l.pain !== null || l.fatigue !== null || l.mood !== null || l.energy !== null
    || l.sleep_bedtime !== null || l.symptoms.length > 0 || !!l.note || !!l.sugar_level;
  const entries = logs.filter(hasContent);

  return (
    <>
      <PageHeader title={t("her.history")} subtitle={t("history.subtitle")} back="/her" backLabel={t("common.back")} />

      <Section title={t("history.periods")}>
        {periods.length === 0 ? (
          <Empty>{t("history.noPeriods")}</Empty>
        ) : (
          <ol className="grid gap-2">
            {periods.map((p, i) => {
              const next = periods[i - 1]; // list is newest first
              return (
                <li key={p.id} className="flex items-center gap-3 text-sm">
                  <span className="size-2.5 rounded-full bg-rose shrink-0" aria-hidden />
                  <span className="flex-1">{formatDay(p.start_date, locale, { day: "numeric", month: "long", year: "numeric" })}</span>
                  {p.end_date && <span className="text-muted">{t("cycle.durationDays", { n: daysBetween(p.start_date, p.end_date) + 1 })}</span>}
                  {next && <span className="text-muted tabular-nums inline-flex items-center gap-1"><AppIcon name="arrowRight" size={13} /> {daysBetween(p.start_date, next.start_date)} {t("common.daysUnit")}</span>}
                </li>
              );
            })}
          </ol>
        )}
      </Section>

      <Section title={t("history.days")}>
        {entries.length === 0 ? (
          <Empty>{t("history.noDays")}</Empty>
        ) : (
          <ul className="grid gap-2">
            {entries.map((l) => (
              <li key={l.log_date} className="rounded-2xl border border-line px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{formatDay(l.log_date, locale, { weekday: "short", day: "numeric", month: "long" })}</span>
                  <span className="flex items-center gap-2 text-sm text-muted">
                    {l.is_period && <span title={t("cycle.flow")} className="inline-flex gap-0.5 text-rose">{Array.from({ length: l.flow ?? 1 }, (_, k) => <AppIcon key={k} name="drop" size={13} />)}</span>}
                    {l.mood_tag ? (
                      <AppIcon name={MOOD_TAG_ICON[l.mood_tag as MoodTag]} size={18} label={t(`wellbeing.moodTags.${l.mood_tag as MoodTag}`)} />
                    ) : l.mood ? (
                      <AppIcon name={`mood${l.mood}` as "mood1"} size={18} label={t("wellbeing.mood")} />
                    ) : null}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  {l.energy !== null && <span>{t("wellbeing.energy")} {l.energy}/10</span>}
                  {l.fatigue !== null && <span>{t("wellbeing.fatigue")} {l.fatigue}/10</span>}
                  {l.pain !== null && <span>{t("wellbeing.pain")} {l.pain}/10</span>}
                  {l.sleep_bedtime && l.sleep_wake_time && (
                    <span>{t("wellbeing.sleep")} {(() => { const m = sleepDurationMin(l.sleep_bedtime, l.sleep_wake_time)!; return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`; })()}</span>
                  )}
                  {l.sugar_level && <span>{t("food.sugarShort")} {t(`food.sugar.${l.sugar_level}`)}</span>}
                  {foodByDay.get(l.log_date) ? <span className="inline-flex items-center gap-1"><AppIcon name="food" size={13} /> {foodByDay.get(l.log_date)}</span> : null}
                </div>
                {l.symptoms.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {l.symptoms.map((s) => (
                      <span key={s} className="text-xs rounded-full bg-surface2 px-2 py-0.5">{t(`symptoms.${s as "cramps"}`)}</span>
                    ))}
                  </div>
                )}
                {l.note && <p className="mt-2 text-sm whitespace-pre-wrap">{l.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
