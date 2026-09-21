"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPastPeriodsAction, deletePeriodAction, endPeriodAction, startPeriodAction } from "@/actions/cycle";
import { useI18n } from "@/lib/i18n/provider";
import { daysBetween, toISODate, type Period } from "@/lib/cycle";
import { formatDay } from "@/lib/format";
import { ErrorNote } from "@/components/Feedback";
import { AppIcon } from "@/components/icons";
import type { ErrCode } from "@/lib/action-utils";

export function PeriodManager({ periods }: { periods: Period[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const today = toISODate();
  const [pending, start] = useTransition();
  const [error, setError] = useState<ErrCode | null>(null);
  const [pastDate, setPastDate] = useState("");
  const [queued, setQueued] = useState<string[]>([]);
  const open = periods.find((p) => !p.end_date && daysBetween(p.start_date, today) < 14);

  const run = (fn: () => Promise<{ ok: boolean; error?: ErrCode }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "generic");
      else router.refresh();
    });

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        {open ? (
          <button className="btn btn-primary" disabled={pending} onClick={() => run(() => endPeriodAction({ id: open.id, date: today }))}>
            {t("cycle.endToday")}
          </button>
        ) : (
          <button className="btn btn-primary" disabled={pending} onClick={() => run(() => startPeriodAction(today))}>
            <AppIcon name="drop" size={18} /> {t("cycle.startToday")}
          </button>
        )}
        <p className="text-xs text-muted text-center">{t("cycle.variableHint")}</p>
      </div>

      <ErrorNote code={error} />

      <ul className="grid gap-2">
        {periods.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3">
            <AppIcon name="drop" size={18} className="text-rose" />
            <div className="flex-1 min-w-0">
              <div className="font-medium">{formatDay(p.start_date, locale)}</div>
              <div className="text-xs text-muted">
                {p.end_date
                  ? t("cycle.durationDays", { n: daysBetween(p.start_date, p.end_date) + 1 })
                  : t("cycle.ongoingOrUnset")}
              </div>
            </div>
            {!p.end_date && p.id !== open?.id && (
              <input
                type="date" aria-label={t("cycle.endDate")} className="field !min-h-10 !w-40 !py-1 text-sm"
                min={p.start_date} max={today}
                onChange={(e) => e.target.value && run(() => endPeriodAction({ id: p.id, date: e.target.value }))}
              />
            )}
            <button className="btn btn-ghost btn-danger !min-h-10 !px-3" aria-label={t("common.delete")} disabled={pending}
              onClick={() => confirm(t("cycle.confirmDelete")) && run(() => deletePeriodAction(p.id))}><AppIcon name="close" size={16} /></button>
          </li>
        ))}
      </ul>

      <details className="rounded-2xl border border-line p-4">
        <summary className="cursor-pointer font-medium">{t("cycle.addPast")}</summary>
        <p className="text-sm text-muted mt-2">{t("cycle.addPastHint")}</p>
        <div className="flex gap-2 mt-3">
          <input type="date" className="field" max={today} value={pastDate} onChange={(e) => setPastDate(e.target.value)} aria-label={t("cycle.startDate")} />
          <button type="button" className="btn" disabled={!pastDate}
            onClick={() => { setQueued((q) => [...new Set([...q, pastDate])].sort()); setPastDate(""); }} aria-label={t("cycle.addPast")}><AppIcon name="plus" size={18} /></button>
        </div>
        {queued.length > 0 && (
          <div className="mt-3 grid gap-3">
            <div className="flex flex-wrap gap-2">
              {queued.map((d) => (
                <button key={d} className="chip" aria-pressed="true" onClick={() => setQueued((q) => q.filter((x) => x !== d))}>
                  {formatDay(d, locale, { day: "numeric", month: "short", year: "numeric" })} <AppIcon name="close" size={13} />
                </button>
              ))}
            </div>
            <button className="btn btn-primary" disabled={pending} onClick={() => run(async () => { const r = await addPastPeriodsAction(queued); if (r.ok) setQueued([]); return r; })}>
              {t("cycle.addAll", { n: queued.length })}
            </button>
          </div>
        )}
      </details>
    </div>
  );
}
