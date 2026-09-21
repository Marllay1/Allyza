"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AppIcon } from "@/components/icons";
import { Polaroid } from "@/features/couple/story/Polaroid";
import { formatDay } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { useSignedUrls } from "@/lib/use-signed-urls";

export type Star = { id: string; title: string; moment_date: string; body: string | null; storage_path: string | null };
export type Counts = { memories: number; photos: number; letters: number; songs: number; jokes: number };

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; };

/**
 * Our Little Universe: every memory from "Our story" becomes a star, joined in the order it happened.
 * Purely decorative and emotional — no scores, no goals, no levels.
 */
export function Constellation({ stars, counts }: { stars: Star[]; counts: Counts }) {
  const { t, locale } = useI18n();
  const [sel, setSel] = useState<string | null>(null);
  const urls = useSignedUrls(stars.map((s) => s.storage_path).filter(Boolean) as string[]);

  const placed = useMemo(() => {
    const n = stars.length;
    return stars.map((s, i) => ({
      ...s,
      x: 50 + Math.sin(i * 1.25 + hash(s.id) * 2) * 30 + (hash(s.id + "x") - 0.5) * 8,
      y: n === 1 ? 70 : 12 + (i / (n - 1)) * 116 + (hash(s.id + "y") - 0.5) * 5,
      r: s.storage_path ? 4.2 : 3,
    }));
  }, [stars]);
  const dust = useMemo(() => Array.from({ length: 42 }, (_, i) => ({ x: hash("dx" + i) * 100, y: hash("dy" + i) * 140, r: 0.25 + hash("dr" + i) * 0.5, d: hash("dd" + i) * 4 })), []);
  const current = placed.find((p) => p.id === sel) ?? null;

  const summary = [
    t("universe.memories", { n: counts.memories }),
    t("universe.photos", { n: counts.photos }),
    t("universe.letters", { n: counts.letters }),
  ].join(" · ");

  return (
    <div className="grid gap-5">
      <p className="text-center font-display text-2xl text-gold" role="status">{summary}</p>

      <div className="relative overflow-hidden rounded-[32px] border border-[var(--glass-line)]" style={{ background: "radial-gradient(120% 90% at 50% 10%, #2a1a52, #0d0820 70%)" }}>
        <svg viewBox="0 0 100 140" className="block w-full h-auto" role="group" aria-label={t("couple.universe")}>
          {dust.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#f7d3bc" opacity="0.5" className="twinkle" style={{ animationDelay: `${d.d}s` }} />)}
          {placed.slice(1).map((p, i) => (
            <line key={p.id} x1={placed[i].x} y1={placed[i].y} x2={p.x} y2={p.y} stroke="#f7d3bc" strokeOpacity="0.28" strokeWidth="0.25" strokeDasharray="1 1.4" />
          ))}
          {placed.map((p) => (
            <g key={p.id} role="button" tabIndex={0} aria-label={`${p.title} · ${formatDay(p.moment_date, locale, { day: "numeric", month: "long", year: "numeric" })}`}
              onClick={() => setSel(p.id === sel ? null : p.id)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSel(p.id === sel ? null : p.id))}
              style={{ cursor: "pointer", outline: "none" }}>
              <circle cx={p.x} cy={p.y} r={p.r * 2.6} fill="#f7d3bc" opacity={sel === p.id ? 0.28 : 0.1} />
              <path d={`M${p.x} ${p.y - p.r * 1.7} Q${p.x} ${p.y} ${p.x + p.r * 1.7} ${p.y} Q${p.x} ${p.y} ${p.x} ${p.y + p.r * 1.7} Q${p.x} ${p.y} ${p.x - p.r * 1.7} ${p.y} Q${p.x} ${p.y} ${p.x} ${p.y - p.r * 1.7}Z`} fill={sel === p.id ? "#fff3e6" : "#f7d3bc"} />
              <circle cx={p.x} cy={p.y} r={p.r * 3.4} fill="transparent" />
            </g>
          ))}
        </svg>
        {placed.length === 0 && (
          <div className="absolute inset-0 grid place-items-center text-center px-8 text-[#d9c9ea]">
            <div className="grid gap-2 justify-items-center">
              <AppIcon name="universe" size={32} className="text-[#f7d3bc]" />
              <p className="font-display text-2xl">{t("universe.emptyTitle")}</p>
              <p className="text-sm max-w-xs text-balance">{t("universe.emptyBody")}</p>
            </div>
          </div>
        )}
      </div>

      {current && (
        <section className="card p-5 grid gap-3 pop-in" aria-live="polite">
          {current.storage_path ? (
            <Polaroid src={urls[current.storage_path] ?? null} caption={current.title} sub={formatDay(current.moment_date, locale, { day: "numeric", month: "long", year: "numeric" })} />
          ) : (
            <div className="text-center">
              <p className="eyebrow">{formatDay(current.moment_date, locale, { day: "numeric", month: "long", year: "numeric" })}</p>
              <h2 className="text-3xl mt-1">{current.title}</h2>
              {current.body && <p className="text-muted mt-2 text-balance">{current.body}</p>}
            </div>
          )}
          <Link href="/us/story" className="btn justify-self-center">{t("universe.open")} <AppIcon name="arrowRight" size={16} /></Link>
        </section>
      )}
      {placed.length > 0 && !current && <p className="text-center text-sm text-muted">{t("universe.tapStar")}</p>}
    </div>
  );
}
