"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDayLogAction, type DayLogInput } from "@/actions/cycle";
import { useI18n } from "@/lib/i18n/provider";
import { MOOD_TAGS, PAIN_TYPES, SYMPTOMS } from "@/lib/constants";
import { addDays, sleepDurationMin, toISODate, type DailyLog } from "@/lib/cycle";
import { formatDay } from "@/lib/format";
import { AppIcon } from "@/components/icons";
import { ErrorNote, Notice } from "@/components/Feedback";
import { MOOD_TAG_ICON, MOOD_TAG_INTENSITY, type MoodTag } from "@/lib/mood";
import type { ErrCode } from "@/lib/action-utils";

type Sections = "period" | "wellbeing";

const blank = (date: string): DayLogInput => ({
  date, is_period: false, flow: null, pain: null, pain_type: null, pain_duration_min: null,
  fatigue: null, mood: null, mood_tag: null, energy: null,
  sleep_bedtime: null, sleep_wake_time: null, sleep_quality: null,
  sugar_level: null, symptoms: [], note: null,
});

const fromLog = (l: DailyLog): DayLogInput => ({
  date: l.log_date, is_period: l.is_period, flow: l.flow, pain: l.pain, pain_type: l.pain_type as DayLogInput["pain_type"],
  pain_duration_min: l.pain_duration_min, fatigue: l.fatigue, mood: l.mood, mood_tag: l.mood_tag as MoodTag | null, energy: l.energy,
  sleep_bedtime: l.sleep_bedtime, sleep_wake_time: l.sleep_wake_time, sleep_quality: l.sleep_quality,
  sugar_level: l.sugar_level, symptoms: l.symptoms as DayLogInput["symptoms"], note: l.note,
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
  const setMoodTag = (tag: MoodTag) => {
    const same = form.mood_tag === tag;
    setForm((f) => ({ ...f, mood_tag: same ? null : tag, mood: same ? null : MOOD_TAG_INTENSITY[tag] }));
    setSaved(false);
  };
  const duration = sleepDurationMin(form.sleep_bedtime, form.sleep_wake_time);
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
        <button type="button" className="btn btn-ghost !px-3" aria-label={t("common.previousDay")} onClick={() => changeDate(addDays(date, -1))}><AppIcon name="back" size={20} /></button>
        <label className="flex-1">
          <span className="sr-only">{t("common.date")}</span>
          <input type="date" className="field text-center" value={date} max={today} onChange={(e) => e.target.value && changeDate(e.target.value)} />
        </label>
        <button type="button" className="btn btn-ghost !px-3" aria-label={t("common.nextDay")} disabled={date >= today} onClick={() => changeDate(addDays(date, 1))}><AppIcon name="forward" size={20} /></button>
      </div>
      <p className="text-center text-sm text-muted -mt-3">{date === today ? t("common.today") : formatDay(date, locale, { weekday: "long", day: "numeric", month: "long" })}</p>

      {sections === "period" && (
        <>
          <div>
            <span className="label">{t("cycle.periodToday")}</span>
            <div className="flex gap-2" role="group">
              <button type="button" className="chip" aria-pressed={form.is_period} onClick={() => set("is_period", true)}><AppIcon name="drop" size={16} /> {t("common.yes")}</button>
              <button type="button" className="chip" aria-pressed={!form.is_period} onClick={() => { set("is_period", false); set("flow", null); }}>{t("common.no")}</button>
            </div>
          </div>
          {form.is_period && (
            <div>
              <span className="label">{t("cycle.flow")}</span>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("cycle.flow")}>
                {[1, 2, 3, 4].map((f) => (
                  <button key={f} type="button" role="radio" aria-checked={form.flow === f} className="chip" onClick={() => set("flow", f)}>
                    <span className="inline-flex">{Array.from({ length: f }, (_, k) => <AppIcon key={k} name="drop" size={13} />)}</span> {t(`cycle.flowLevel.${f as 1 | 2 | 3 | 4}`)}
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
            <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={t("wellbeing.mood")}>
              {MOOD_TAGS.map((tag) => (
                <button key={tag} type="button" role="radio" aria-checked={form.mood_tag === tag} onClick={() => setMoodTag(tag)}
                  className="chip !flex-col !min-h-16 !rounded-2xl !justify-center !px-1 text-center">
                  <AppIcon name={MOOD_TAG_ICON[tag]} size={24} />
                  <span className="text-[0.68rem] leading-tight">{t(`wellbeing.moodTags.${tag}`)}</span>
                </button>
              ))}
            </div>
          </div>

          <Scale label={t("wellbeing.energy")} value={form.energy} onChange={(v) => set("energy", v)} low={t("wellbeing.none")} high={t("wellbeing.max")} />
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

          <div className="grid gap-3 rounded-2xl border border-line p-4">
            <span className="label !mb-0">{t("wellbeing.sleep")}</span>
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="text-xs text-muted">{t("wellbeing.sleepBedtime")}</span>
                <input type="time" className="field" value={form.sleep_bedtime ?? ""} onChange={(e) => set("sleep_bedtime", e.target.value || null)} />
              </label>
              <label>
                <span className="text-xs text-muted">{t("wellbeing.sleepWake")}</span>
                <input type="time" className="field" value={form.sleep_wake_time ?? ""} onChange={(e) => set("sleep_wake_time", e.target.value || null)} />
              </label>
            </div>
            {duration !== null && (
              <p className="text-sm text-muted">{t("wellbeing.sleepDuration", { h: Math.floor(duration / 60), m: duration % 60 })}</p>
            )}
            <div>
              <span className="text-xs text-muted">{t("wellbeing.sleepQuality")}</span>
              <div className="flex flex-wrap gap-2 mt-1.5" role="radiogroup" aria-label={t("wellbeing.sleepQuality")}>
                {[1, 2, 3, 4, 5].map((q) => (
                  <button key={q} type="button" role="radio" aria-checked={form.sleep_quality === q} className="chip"
                    onClick={() => set("sleep_quality", form.sleep_quality === q ? null : q)}>
                    {t(`wellbeing.sleepQualityLevel.${q as 1 | 2 | 3 | 4 | 5}`)}
                  </button>
                ))}
              </div>
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
        {saved && <span role="status" className="text-good text-sm"><AppIcon name="check" size={16} className="inline" /> {t("common.saved")}</span>}
      </div>
    </div>
  );
}
