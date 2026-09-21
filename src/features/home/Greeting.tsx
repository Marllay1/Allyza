"use client";
import { AppIcon, type IconName } from "@/components/icons";
import { useT } from "@/lib/i18n/provider";
import { useDayNumber } from "@/lib/use-day-index";

type Part = "night" | "morning" | "afternoon" | "evening";
const partOf = (h: number): Part => (h < 5 ? "night" : h < 12 ? "morning" : h < 18 ? "afternoon" : "evening");
const ICON: Record<Part, IconName> = { night: "moon", morning: "sun", afternoon: "sun", evening: "moon" };

/**
 * Warm without pretending to know anything: the line only depends on the time of day,
 * never on health data that was not recorded.
 */
export function Greeting({ name }: { name: string }) {
  const t = useT();
  const day = useDayNumber();
  const part = partOf(new Date().getHours());
  const lines = t.arr(`home.lines.${part}`);
  return (
    <div className="mb-6 rise">
      <p className="eyebrow inline-flex items-center gap-2"><AppIcon name={ICON[part]} size={14} /> {t(`home.partLabel.${part}`)}</p>
      <h1 className="text-[2.7rem] leading-[1.05] mt-1">{t(`home.greeting.${part}`, { name })}</h1>
      <p className="text-muted mt-2 text-balance">{lines.length ? lines[day % lines.length] : ""}</p>
    </div>
  );
}
