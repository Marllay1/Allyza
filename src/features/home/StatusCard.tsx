"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toISODate } from "@/lib/cycle";
import { useT } from "@/lib/i18n/provider";

type Band = "low" | "medium" | "high" | null;
type Status = {
  linked: boolean; cycle_day: number | null; on_period: boolean | null; pain: Band; fatigue: Band;
  mood: "low" | "neutral" | "good" | null; wellbeing: "gentle" | "ok" | "good" | null;
  sugar: "low" | "moderate" | "high" | null; avg_cycle: number | null;
};

/** "How is she today?" — only ever what she chose to share, read through partner_shared_status(). */
export function StatusCard({ name, compact = false }: { name: string; compact?: boolean }) {
  const t = useT();
  const [s, setS] = useState<Status | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    const load = async () => {
      const { data } = await supabase.rpc("partner_shared_status", { p_today: toISODate() });
      if (alive && data) setS(data as Status);
    };
    load();
    const id = setInterval(load, 60_000);
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  if (!s) return <p className="text-sm text-muted">{t("common.loading")}</p>;

  // Gentle, never directive. Only what she chose to share can ever appear here.
  const lines: string[] = [];
  if (s.fatigue === "high") lines.push(t("partner.tired"));
  if (s.pain === "high") lines.push(t("partner.hardDay"));
  if (s.mood === "low") lines.push(t("partner.needsSoftness"));
  if (s.mood === "good" && s.fatigue !== "high" && s.pain !== "high") lines.push(t("partner.goodMood"));
  if (s.wellbeing === "gentle" && lines.length === 0) lines.push(t("partner.gentleDay"));
  if (s.wellbeing === "good" && lines.length === 0) lines.push(t("partner.goingWell"));
  const soft = s.fatigue === "high" || s.pain === "high" || s.mood === "low" || s.wellbeing === "gentle";
  const facts: string[] = [];
  if (s.cycle_day) facts.push(t("partner.cycleDay", { n: s.cycle_day }));
  if (s.on_period) facts.push(t("partner.onPeriod"));
  if (s.avg_cycle) facts.push(t("partner.avgCycle", { n: s.avg_cycle }));
  if (s.sugar) facts.push(t(`partner.sugar.${s.sugar}`));

  if (lines.length === 0 && facts.length === 0) {
    return (
      <div className={compact ? "text-left" : "text-center py-2"}>
        <p className={compact ? "font-display text-xl" : "font-display text-2xl"}>{t("partner.nothingTitle")}</p>
        {!compact && <p className="text-sm text-muted mt-1 text-balance">{t("partner.nothingBody", { name })}</p>}
      </div>
    );
  }
  return (
    <div className="grid gap-3">
      {lines.slice(0, compact ? 1 : undefined).map((l) => <p key={l} className={compact ? "font-display text-xl leading-snug" : "font-display text-2xl leading-snug"}>{l}</p>)}
      {soft && !compact && <p className="text-muted">{t("partner.suggestion")}</p>}
      {facts.length > 0 && (
        <ul className="flex flex-wrap gap-2 pt-1">
          {facts.slice(0, compact ? 2 : undefined).map((f) => <li key={f} className="chip !cursor-default">{f}</li>)}
        </ul>
      )}
    </div>
  );
}
