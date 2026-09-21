"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addFoodAction } from "@/actions/cycle";
import { updatePrefsAction } from "@/actions/prefs";
import { AppIcon } from "@/components/icons";
import { useUnread } from "@/components/AppShell";
import { Section, Stat, TileLink } from "@/components/ui";
import { CheckIn } from "@/features/home/CheckIn";
import { Greeting } from "@/features/home/Greeting";
import { computeStats, currentCycleDay, toISODate, type DailyLog, type FoodLog, type Period } from "@/lib/cycle";
import { formatDay } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { startNight } from "@/lib/local-pref";

type Props = { name: string; partnerName: string; periods: Period[]; logs: DailyLog[]; food: FoodLog[]; sharedCount: number; hasPartner: boolean; soft: boolean };

export function HomeHer({ name, partnerName, periods, logs, food, sharedCount, hasPartner, soft }: Props) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { unread } = useUnread();
  const [pending, start] = useTransition();
  const [drank, setDrank] = useState(false);
  const today = toISODate();
  const day = currentCycleDay(periods, today);
  const stats = computeStats(periods);
  const last = [...periods].sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
  const log = logs.find((l) => l.log_date === today);
  const water = food.filter((f) => f.log_date === today && f.category === "water").length + (drank ? 1 : 0);
  const fromHim = unread.journal + unread.media + unread.little + unread.surprise + unread.refuge;

  return (
    <>
      <Greeting name={name} />
      {soft && <p className="text-muted -mt-3 mb-5">{t("soft.welcome")}</p>}

      <CheckIn partnerName={partnerName} hasPartner={hasPartner} />

      {/* three rooms, one universe */}
      <div className="grid gap-3 mb-6">
        <TileLink href="/her" icon="her" tone="rose" title={t("home.herTitle")} text={day ? t("home.herCardDay", { n: day }) : t("home.herCard")} />
        <TileLink href="/refuge" icon="refuge" tone="mauve" title={t("nav.refuge")} text={t("home.refugeCard")} right={unread.refuge > 0 ? <span className="size-2.5 rounded-full bg-rose pop-in" role="status" aria-label={t("nav.new")} /> : undefined} />
        <TileLink
          href={unread.surprise > 0 ? "/us/surprises" : "/us"}
          icon="us" tone="gold" title={t("nav.us")}
          text={fromHim > 0 ? t("home.usLeft", { name: partnerName }) : t("home.usCard")}
          right={fromHim > 0 ? <span className="size-2.5 rounded-full bg-rose pop-in" role="status" aria-label={t("nav.new")} /> : undefined}
        />
      </div>

      <Section title={t("home.todayTitle")}>
        <div className="grid grid-cols-2 gap-3">
          <Stat icon="cycle" label={t("home.cycleDay")} value={day ? day : "–"} hint={last ? t("home.since", { date: formatDay(last.start_date, locale) }) : t("home.noPeriodYet")} />
          <Stat icon="calendar" label={t("stats.avgCycleLabel")} value={stats.avgCycle ? t("common.daysShort", { n: stats.avgCycle }) : "–"} hint={stats.avgCycle ? t("stats.observedHint") : t("stats.notEnough")} />
          <Stat icon="mood4" label={t("wellbeing.mood")} value={log?.mood ? <AppIcon name={`mood${log.mood}` as "mood1"} size={30} label={t(`wellbeing.moodLevel.${log.mood as 1 | 2 | 3 | 4 | 5}`)} /> : "–"} />
          <Stat icon="wellbeing" label={t("wellbeing.fatigue")} value={log?.fatigue != null ? `${log.fatigue}/10` : "–"} />
          <Stat icon="stats" label={t("wellbeing.pain")} value={log?.pain != null ? `${log.pain}/10` : "–"} />
          <Stat icon="hydration" label={t("home.hydration")} value={water} />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <Link href="/her/wellbeing" className="btn btn-primary">{t("home.logToday")}</Link>
          <Link href="/her/cycle" className="btn"><AppIcon name="drop" size={16} /> {t("home.period")}</Link>
        </div>
      </Section>

      {soft && (
        <Section title={t("soft.title")}>
          <div className="grid gap-2">
            <button className="btn justify-start" disabled={pending} onClick={() => start(async () => { const r = await addFoodAction({ date: today, category: "water" }); if (r.ok) { setDrank(true); router.refresh(); } })}>
              <AppIcon name="hydration" size={18} /> {t("soft.water")}
            </button>
            <Link href="/refuge/breathe" className="btn justify-start"><AppIcon name="breathe" size={18} /> {t("soft.rest")}</Link>
            <Link href="/refuge/atmosphere" className="btn justify-start"><AppIcon name="atmosphere" size={18} /> {t("soft.music")}</Link>
            <Link href="/refuge/games" className="btn justify-start"><AppIcon name="games" size={18} /> {t("soft.game")}</Link>
            <Link href="/refuge/messages" className="btn justify-start"><AppIcon name="mail" size={18} /> {t("soft.message")}</Link>
            <Link href="/us" className="btn justify-start"><AppIcon name="us" size={18} /> {t("soft.us")}</Link>
          </div>
          <p className="text-xs text-muted mt-3">{t("soft.notAssumption")}</p>
        </Section>
      )}

      {hasPartner && (
        <div className="mb-4">
          <TileLink href="/settings/sharing" icon="lock" tone="accent" title={t("home.sharing")} text={sharedCount === 0 ? t("home.sharingNone") : t("home.sharingCount", { n: sharedCount })} />
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-2 pt-2">
        <button className="btn btn-ghost text-sm" onClick={startNight}><AppIcon name="night" size={16} /> {t("night.start")}</button>
        <button className="btn btn-ghost text-sm" disabled={pending} onClick={() => start(async () => { await updatePrefsAction({ soft_mode: !soft }); router.refresh(); })}>
          <AppIcon name="soft" size={16} /> {soft ? t("soft.turnOff") : t("soft.turnOn")}
        </button>
      </div>
    </>
  );
}
