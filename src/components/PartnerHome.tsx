"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/provider";
import { toISODate } from "@/lib/cycle";
import { Section, TileLink } from "@/components/ui";
import { ClientOnly } from "@/components/ClientOnly";

type Band = "low" | "medium" | "high" | null;
type Status = {
  linked: boolean;
  cycle_day: number | null;
  on_period: boolean | null;
  pain: Band;
  fatigue: Band;
  mood: "low" | "neutral" | "good" | null;
  wellbeing: "gentle" | "ok" | "good" | null;
  sugar: "low" | "moderate" | "high" | null;
  avg_cycle: number | null;
};

function StatusCard({ name }: { name: string }) {
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
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
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
      <div className="text-center py-2">
        <p className="font-display text-2xl">{t("partner.nothingTitle")}</p>
        <p className="text-sm text-muted mt-1 text-balance">{t("partner.nothingBody", { name })}</p>
      </div>
    );
  }
  return (
    <div className="grid gap-3">
      {lines.map((l) => (
        <p key={l} className="font-display text-2xl leading-snug">{l}</p>
      ))}
      {soft && <p className="text-muted">{t("partner.suggestion")}</p>}
      {facts.length > 0 && (
        <ul className="flex flex-wrap gap-2 pt-1">
          {facts.map((f) => (
            <li key={f} className="chip !cursor-default">{f}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PartnerHome({ herName }: { herName: string }) {
  const t = useT();
  return (
    <>
      <div className="mb-5 rise">
        <p className="eyebrow">{t("partner.eyebrow")}</p>
        <h1 className="text-4xl">{herName}</h1>
      </div>
      <Section title={t("partner.today")}>
        <ClientOnly fallback={<p className="text-sm text-muted">{t("common.loading")}</p>}>
          <StatusCard name={herName} />
        </ClientOnly>
        <p className="text-xs text-muted mt-4">{t("partner.onlyShared", { name: herName })}</p>
      </Section>
      <div className="grid gap-3">
        <TileLink href="/refuge/messages" icon="💌" title={t("partner.sendMessage")} text={t("partner.sendMessageText")} />
        <TileLink href="/us/journal" icon="📖" title={t("couple.journal")} text={t("partner.journalText")} />
        <Link href="/us" className="btn mt-1">{t("nav.us")}</Link>
      </div>
    </>
  );
}
