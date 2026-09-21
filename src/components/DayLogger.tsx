"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDayLogAction, type DayLogInput } from "@/actions/cycle";
import { useI18n } from "@/lib/i18n/provider";
import { PAIN_TYPES, SYMPTOMS } from "@/lib/constants";
import { addDays, toISODate, type DailyLog } from "@/lib/cycle";
import { MOOD_EMOJI, formatDay } from "@/lib/format";
import { ErrorNote, Notice } from "@/components/Feedback";
import type { ErrCode } from "@/lib/action-utils";

type Sections = "period" | "wellbeing";

const blank = (date: string): DayLogInput => ({
  date, is_period: false, flow: null, pain: null, pain_type: null, pain_duration_min: null,
  fatigue: null, mood: null, sugar_level: null, symptoms: [], note: null,
});

const fromLog = (l: DailyLog): DayLogInput => ({
  date: l.log_date, is_period: l.is_period, flow: l.flow, pain: l.pain, pain_type: l.pain_type as DayLogInput["pain_type"],
  pain_duration_min: l.pain_duration_min, fatigue: l.fatigue, mood: l.mood, sugar_level: l.sugar_level,
  symptoms: l.symptoms as DayLogInput["symptoms"], note: l.note,
});

function Scale({ value, onChange, label, low, high }: { value: number | null; onChange: (v: number | null) => void; label: string; low: string; high: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="label !mb-1">{label}</span>
        <span className="font-display text-2xl tabular-nums">{value ?? "–"}<span className="text-sm text-muted">/10</span></span>
      </div>
      <input
        type="range" min={0} max={10} step={1} value={value ?? 0}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerDown={() => value === null && onChange(0)}
        aria-label={label}
        className="w-full accent-[var(--accent)] h-8"
      />
      <div className="flex justify-between text-xs text-muted -mt-1"><span>{low}</span><span>{high}</span></div>
    </div>
  );
}

export function DayLogger({ logs, sections }: { logs: DailyLog[]; sections: Sections }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const byDate = useMemo(() => new Map(logs.map((l) => [l.log_date, l])), [logs]);
  const today = toISODate();
  const [date, setDate] = useState(today);
  const [form, setForm] = useState<DayLogInput>(() => (byDate.get(today) ? fromLog(byDate.get(today)!) : blank(today)));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<ErrCode | null>(null);
  const [pending, start] = useTransition();

  const set = <K extends keyof DayLogInput>(k: K, v: DayLogInput[K]) => { setForm((f) => ({ ...f, [k]: v })); setSaved(false); };
  const changeDate = (d: string) => {
    setDate(d); setSaved(false); setError(null);
    setForm(byDate.get(d) ? fromLog(byDate.get(d)!) : blank(d));
  };

  const recentHeavy = logs.filter((l) => l.log_date >= addDays(today, -7) && (l.pain ?? 0) >= 8).length;
  const showCare = (form.pain ?? 0) >= 9 || recentHeavy >= 3;

  const save = () => start(async () => {
    setError(null);
    const r = await saveDayLogAction({ ...form, date });
    if (r.ok) { setSaved(true); router.refresh(); } else setError(r.error);
  });

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-2">
        <button type="button" className="btn btn-ghost !px-3" aria-label={t("common.previousDay")} onClick={() => changeDate(addDays(date, -1))}>‹</button>
        <label className="flex-1">
          <span className="sr-only">{t("common.date")}</span>
          <input type="date" className="field text-center" value={date} max={today} onChange={(e) => e.target.value && changeDate(e.target.value)} />
        </label>
        <button type="button" className="btn btn-ghost !px-3" aria-label={t("common.nextDay")} disabled={date >= today} onClick={() => changeDate(addDays(date, 1))}>›</button>
      </div>
      <p className="text-center text-sm text-muted -mt-3">{date === today ? t("common.today") : formatDay(date, locale, { weekday: "long", day: "numeric", month: "long" })}</p>

      {sections === "period" && (
        <>
          <div>
            <span className="label">{t("cycle.periodToday")}</span>
            <div className="flex gap-2" role="group">
              <button type="button" className="chip" aria-pressed={form.is_period} onClick={() => set("is_period", true)}>🩸 {t("common.yes")}</button>
              <button type="button" className="chip" aria-pressed={!form.is_period} onClick={() => { set("is_period", false); set("flow", null); }}>{t("common.no")}</button>
            </div>
          </div>
          {form.is_period && (
            <div>
              <span className="label">{t("cycle.flow")}</span>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("cycle.flow")}>
                {[1, 2, 3, 4].map((f) => (
                  <button key={f} type="button" role="radio" aria-checked={form.flow === f} className="chip" onClick={() => set("flow", f)}>
                    {"💧".repeat(f)} {t(`cycle.flowLevel.${f as 1 | 2 | 3 | 4}`)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {sections === "wellbeing" && (
        <>
          <div>
            <span className="label">{t("wellbeing.mood")}</span>
            <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={t("wellbeing.mood")}>
              {[1, 2, 3, 4, 5].map((m) => (
                <button key={m} type="button" role="radio" aria-checked={form.mood === m} onClick={() => set("mood", form.mood === m ? null : m)}
                  className="chip !flex-col !min-h-16 !rounded-2xl !justify-center !px-1 text-center">
                  <span className="text-2xl leading-none" aria-hidden>{MOOD_EMOJI[m - 1]}</span>
                  <span className="text-[0.68rem] leading-tight">{t(`wellbeing.moodLevel.${m as 1 | 2 | 3 | 4 | 5}`)}</span>
                </button>
              ))}
            </div>
          </div>

          <Scale label={t("wellbeing.fatigue")} value={form.fatigue} onChange={(v) => set("fatigue", v)} low={t("wellbeing.none")} high={t("wellbeing.max")} />
          <Scale label={t("wellbeing.pain")} value={form.pain} onChange={(v) => set("pain", v)} low={t("wellbeing.none")} high={t("wellbeing.max")} />

          {form.pain !== null && form.pain > 0 && (
            <div className="grid gap-3 rounded-2xl border border-line p-4">
              <div>
                <span className="label">{t("wellbeing.painType")}</span>
                <div className="flex flex-wrap gap-2">
                  {PAIN_TYPES.map((p) => (
                    <button key={p} type="button" className="chip" aria-pressed={form.pain_type === p} onClick={() => set("pain_type", form.pain_type === p ? null : p)}>
                      {t(`wellbeing.painTypes.${p}`)}
                    </button>
                  ))}
                </div>
              </div>
              <label>
                <span className="label">{t("wellbeing.painDuration")}</span>
                <input type="number" inputMode="numeric" min={0} max={1440} className="field" placeholder="60"
                  value={form.pain_duration_min ?? ""} onChange={(e) => set("pain_duration_min", e.target.value === "" ? null : Math.min(1440, Math.max(0, Number(e.target.value))))} />
              </label>
            </div>
          )}
          {showCare && <Notice tone="care">{t("care.painNudge")}</Notice>}

          <div>
            <span className="label">{t("wellbeing.symptoms")}</span>
            <div className="flex flex-wrap gap-2">
              {SYMPTOMS.map((s) => {
                const on = form.symptoms.includes(s);
                return (
                  <button key={s} type="button" className="chip" aria-pressed={on}
                    onClick={() => set("symptoms", on ? form.symptoms.filter((x) => x !== s) : [...form.symptoms, s])}>
                    {t(`symptoms.${s}`)}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      <label>
        <span className="label">{t("common.note")}</span>
        <textarea className="field" maxLength={1000} placeholder={t("common.notePlaceholder")} value={form.note ?? ""} onChange={(e) => set("note", e.target.value || null)} />
      </label>

      <ErrorNote code={error} />
      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-primary flex-1" onClick={save} disabled={pending}>{pending ? t("common.loading") : t("common.save")}</button>
        {saved && <span role="status" className="text-good text-sm">✓ {t("common.saved")}</span>}
      </div>
    </div>
  );
}
