"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addFoodAction } from "@/actions/cycle";
import { updatePrefsAction } from "@/actions/prefs";
import { useI18n } from "@/lib/i18n/provider";
import { computeStats, currentCycleDay, toISODate, type DailyLog, type FoodLog, type Period } from "@/lib/cycle";
import { MOOD_EMOJI, formatDay } from "@/lib/format";
import { Section, Stat, TileLink } from "@/components/ui";

type Props = {
  name: string;
  periods: Period[];
  logs: DailyLog[];
  food: FoodLog[];
  sharedCount: number;
  hasPartner: boolean;
  soft: boolean;
};

export function HerDashboard({ name, periods, logs, food, sharedCount, hasPartner, soft }: Props) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [drank, setDrank] = useState(false);
  const today = toISODate();
  const day = currentCycleDay(periods, today);
  const stats = computeStats(periods);
  const last = [...periods].sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
  const log = logs.find((l) => l.log_date === today);
  const water = food.filter((f) => f.log_date === today && f.category === "water").length + (drank ? 1 : 0);
  const hour = new Date().getHours();
  const greeting = hour < 5 ? t("home.night") : hour < 12 ? t("home.morning") : hour < 18 ? t("home.afternoon") : t("home.evening");

  const toggleSoft = () =>
    start(async () => {
      await updatePrefsAction({ soft_mode: !soft });
      router.refresh();
    });

  return (
    <>
      <div className="mb-5 rise">
        <p className="eyebrow">{greeting}</p>
        <h1 className="text-4xl">{name}</h1>
        {soft && <p className="text-muted mt-1">{t("soft.welcome")}</p>}
      </div>

      <Section>
        <div className="grid grid-cols-2 gap-3">
          <Stat label={t("home.cycleDay")} value={day ? day : "–"} hint={last ? t("home.since", { date: formatDay(last.start_date, locale) }) : t("home.noPeriodYet")} />
          <Stat
            label={t("stats.avgCycleLabel")}
            value={stats.avgCycle ? t("common.daysShort", { n: stats.avgCycle }) : "–"}
            hint={stats.avgCycle ? t("stats.observedHint") : t("stats.notEnough")}
          />
          <Stat label={t("wellbeing.mood")} value={log?.mood ? MOOD_EMOJI[log.mood - 1] : "–"} />
          <Stat label={t("wellbeing.fatigue")} value={log?.fatigue != null ? `${log.fatigue}/10` : "–"} />
          <Stat label={t("wellbeing.pain")} value={log?.pain != null ? `${log.pain}/10` : "–"} />
          <Stat label={t("home.hydration")} value={`💧 ${water}`} />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <Link href="/her/wellbeing" className="btn btn-primary">{t("home.logToday")}</Link>
          <Link href="/her/cycle" className="btn">🩸 {t("home.period")}</Link>
        </div>
      </Section>

      {soft && (
        <Section title={t("soft.title")}>
          <div className="grid gap-2">
            <button className="btn justify-start" disabled={pending} onClick={() => start(async () => { const r = await addFoodAction({ date: today, category: "water" }); if (r.ok) { setDrank(true); router.refresh(); } })}>
              💧 {t("soft.water")}
            </button>
            <Link href="/refuge/breathe" className="btn justify-start">🌿 {t("soft.rest")}</Link>
            <Link href="/refuge/atmosphere" className="btn justify-start">🎧 {t("soft.music")}</Link>
            <Link href="/refuge/games" className="btn justify-start">🎮 {t("soft.game")}</Link>
            <Link href="/refuge/messages" className="btn justify-start">💌 {t("soft.message")}</Link>
            <Link href="/us" className="btn justify-start">💕 {t("soft.us")}</Link>
          </div>
          <p className="text-xs text-muted mt-3">{t("soft.notAssumption")}</p>
        </Section>
      )}

      <div className="grid gap-3 mb-4">
        {!soft && <TileLink href="/refuge" icon="🌙" title={t("nav.refuge")} text={t("home.refuge")} />}
        <TileLink href="/us" icon="💕" title={t("nav.us")} text={t("home.us")} />
        {hasPartner && (
          <TileLink href="/settings/sharing" icon="🔒" title={t("home.sharing")} text={sharedCount === 0 ? t("home.sharingNone") : t("home.sharingCount", { n: sharedCount })} />
        )}
      </div>

      <div className="text-center">
        <button className="btn btn-ghost text-sm" disabled={pending} onClick={toggleSoft}>
          {soft ? t("soft.turnOff") : `🌸 ${t("soft.turnOn")}`}
        </button>
      </div>
    </>
  );
}
