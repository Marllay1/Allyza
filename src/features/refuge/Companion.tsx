"use client";
import { useState } from "react";
import { useUnread } from "@/components/AppShell";
import { useT } from "@/lib/i18n/provider";
import { haptic } from "@/lib/local-pref";
import { useDayNumber } from "@/lib/use-day-index";

/**
 * A tiny moon that keeps her company. It is NOT a pet: nothing to feed, no streaks, no guilt.
 * It just says a gentle line, and mentions when something was left for her.
 */
export function Companion() {
  const t = useT();
  const { unread } = useUnread();
  const day = useDayNumber();
  const [step, setStep] = useState(0);
  const [bounce, setBounce] = useState(0);

  const waiting = unread.refuge + unread.surprise > 0;
  const lines = t.arr("companion.lines");
  const line = waiting && step === 0 ? t("companion.waiting") : lines[(day + step) % Math.max(1, lines.length)] ?? "";

  return (
    <button
      type="button"
      onClick={() => { setStep((s) => s + 1); setBounce((b) => b + 1); haptic(8); }}
      className="flex items-center gap-4 w-full text-left card p-4 mb-5 rise"
      aria-label={t("companion.tap")}
      aria-live="polite"
    >
      <span key={bounce} className="shrink-0 pop-in" style={{ animation: "float-slow 7s ease-in-out infinite" }}>
        <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden>
          <defs>
            <radialGradient id="cm" cx="38%" cy="32%" r="80%"><stop offset="0" stopColor="#fff3e6" /><stop offset="1" stopColor="#f0b8a4" /></radialGradient>
          </defs>
          <path d="M50 8 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="var(--gold)" className="twinkle" />
          <circle cx="30" cy="34" r="22" fill="url(#cm)" />
          <circle cx="23" cy="34" r="2.6" fill="#3a2440"><animate attributeName="ry" values="2.6;0.4;2.6" dur="5s" repeatCount="indefinite" keyTimes="0;0.04;0.08" calcMode="discrete" /></circle>
          <circle cx="37" cy="34" r="2.6" fill="#3a2440" />
          <circle cx="19" cy="40" r="3.2" fill="#e58aa2" opacity="0.5" />
          <circle cx="41" cy="40" r="3.2" fill="#e58aa2" opacity="0.5" />
          <path d="M26.5 41 q3.5 3 7 0" stroke="#3a2440" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        </svg>
      </span>
      <span className="font-display text-xl leading-snug">{line}</span>
    </button>
  );
}
