"use client";
import { useState } from "react";
import { useDayNumber } from "@/lib/use-day-index";

/** "A little note": one gentle line per day, with a tap to get another. */
export function RefugeNote({ notes, label }: { notes: string[]; label: string }) {
  const day = useDayNumber();
  const [step, setStep] = useState(0);
  if (!notes.length) return null;
  const i = (day + step) % notes.length;
  return (
    <button type="button" onClick={() => setStep((s) => s + 1)} className="card w-full text-left p-5 mb-4 rise" aria-live="polite">
      <span className="eyebrow">💌 {label}</span>
      <span className="block font-display text-2xl leading-snug mt-2 min-h-[3.5rem]">{day === 0 ? "" : notes[i]}</span>
    </button>
  );
}
