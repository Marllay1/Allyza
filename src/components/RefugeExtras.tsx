"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePrefsAction } from "@/actions/prefs";
import { useT } from "@/lib/i18n/provider";
import { toISODate } from "@/lib/cycle";
import { useDayNumber } from "@/lib/use-day-index";

export function PoetryReader({ poems }: { poems: string[] }) {
  const t = useT();
  const day = useDayNumber();
  const [step, setStep] = useState(0);
  if (!poems.length) return null;
  const i = (((day + step) % poems.length) + poems.length) % poems.length;
  return (
    <div className="grid gap-5">
      <article className="card p-8 min-h-72 flex items-center justify-center text-center rise" key={i} aria-live="polite">
        <p className="font-display text-2xl sm:text-3xl leading-relaxed whitespace-pre-line">{day === 0 ? "" : poems[i]}</p>
      </article>
      <div className="flex gap-3">
        <button className="btn flex-1" onClick={() => setStep((s) => s - 1)}>‹ {t("common.previous")}</button>
        <button className="btn flex-1" onClick={() => setStep((s) => s + 1)}>{t("common.next")} ›</button>
      </div>
      <p className="text-center text-xs text-muted">{i + 1} / {poems.length}</p>
    </div>
  );
}

const PHASES = [
  { key: "in", secs: 4, scale: 1 },
  { key: "hold", secs: 4, scale: 1 },
  { key: "out", secs: 6, scale: 0.7 },
] as const;

export function Breathe() {
  const t = useT();
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0);
  const [cycles, setCycles] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!running) return;
    timer.current = setTimeout(() => {
      const next = (phase + 1) % PHASES.length;
      if (next === 0) setCycles((c) => c + 1);
      setPhase(next);
    }, PHASES[phase].secs * 1000);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [running, phase]);

  const p = PHASES[phase];
  return (
    <div className="grid gap-8 justify-items-center py-4">
      <div className="relative size-64 grid place-items-center" role="img" aria-label={t("breathe.label")}>
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-accent/40 to-rose/30 blur-2xl" />
        <div className="relative size-56 rounded-full border border-accent/50 bg-gradient-to-br from-accent/30 to-rose/20 grid place-items-center"
          style={{ transform: `scale(${running ? p.scale : 0.7})`, transition: running ? `transform ${p.secs}s ease-in-out` : "transform 0.6s" }}>
          <span className="font-display text-3xl" aria-live="polite">{running ? t(`breathe.phase.${p.key}`) : t("breathe.ready")}</span>
        </div>
      </div>
      <button className="btn btn-primary min-w-48" onClick={() => { setRunning((r) => !r); setPhase(0); setCycles(0); }}>
        {running ? t("breathe.stop") : t("breathe.start")}
      </button>
      {cycles > 0 && <p className="text-sm text-muted" role="status">{t("breathe.cycles", { n: cycles })}</p>}
    </div>
  );
}

/** "Little things": a tiny, pressure-free list of comforts for today. Kept on this device only. */
export function TinyComforts({ items }: { items: string[] }) {
  const t = useT();
  const key = `allyza.tiny.${toISODate()}`;
  // Rendered inside <ClientOnly>, so reading localStorage during the first render is safe.
  const [done, setDone] = useState<number[]>(() => { try { return JSON.parse(localStorage.getItem(key) ?? "[]"); } catch { return []; } });
  const toggle = (i: number) => {
    const next = done.includes(i) ? done.filter((x) => x !== i) : [...done, i];
    setDone(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
  };
  return (
    <ul className="grid gap-2.5">
      {items.map((it, i) => (
        <li key={it}>
          <button className="card w-full text-left p-4 flex items-center gap-3" aria-pressed={done.includes(i)} onClick={() => toggle(i)}>
            <span className={`size-7 rounded-full border grid place-items-center text-sm ${done.includes(i) ? "bg-accent text-accent-ink border-transparent" : "border-line"}`} aria-hidden>{done.includes(i) ? "✓" : ""}</span>
            <span className={done.includes(i) ? "line-through text-muted" : ""}>{it}</span>
          </button>
        </li>
      ))}
      {done.length === items.length && items.length > 0 && <p className="text-center text-muted mt-2 rise">{t("refuge.tinyDone")}</p>}
    </ul>
  );
}

export function SoftToggle({ on }: { on: boolean }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button className={`btn ${on ? "" : "btn-primary"} w-full !min-h-14`} disabled={pending}
      onClick={() => start(async () => { await updatePrefsAction({ soft_mode: !on }); router.refresh(); })}>
      {on ? t("soft.turnOff") : `🌸 ${t("soft.turnOn")}`}
    </button>
  );
}
