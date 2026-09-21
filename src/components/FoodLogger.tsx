"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addFoodAction, deleteFoodAction, saveDayLogAction } from "@/actions/cycle";
import { useI18n } from "@/lib/i18n/provider";
import { FOOD_CATEGORIES } from "@/lib/constants";
import { toISODate, type DailyLog, type FoodLog } from "@/lib/cycle";
import { ErrorNote } from "@/components/Feedback";
import type { ErrCode } from "@/lib/action-utils";

const ICON: Record<string, string> = {
  fruit: "🍓", vegetables: "🥦", protein: "🍗", legumes: "🫘", whole_grains: "🌾",
  water: "💧", sweet_foods: "🍰", sugary_drinks: "🥤", other: "🍽️",
};

export function FoodLogger({ food, logs }: { food: FoodLog[]; logs: DailyLog[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const today = toISODate();
  const todayLog = logs.find((l) => l.log_date === today) ?? null;
  const [pending, start] = useTransition();
  const [error, setError] = useState<ErrCode | null>(null);
  const [sugar, setSugar] = useState<DailyLog["sugar_level"]>(todayLog?.sugar_level ?? null);
  const todays = food.filter((f) => f.log_date === today);

  const run = (fn: () => Promise<{ ok: boolean; error?: ErrCode }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "generic");
      else router.refresh();
    });

  const saveSugar = (v: NonNullable<DailyLog["sugar_level"]> | null) => {
    setSugar(v);
    run(() =>
      saveDayLogAction({
        date: today,
        is_period: todayLog?.is_period ?? false,
        flow: todayLog?.flow ?? null,
        pain: todayLog?.pain ?? null,
        pain_type: (todayLog?.pain_type as never) ?? null,
        pain_duration_min: todayLog?.pain_duration_min ?? null,
        fatigue: todayLog?.fatigue ?? null,
        mood: todayLog?.mood ?? null,
        sugar_level: v,
        symptoms: (todayLog?.symptoms as never) ?? [],
        note: todayLog?.note ?? null,
      }),
    );
  };

  return (
    <div className="grid gap-6">
      <div>
        <span className="label">{t("food.addPrompt")}</span>
        <div className="grid grid-cols-3 gap-2">
          {FOOD_CATEGORIES.map((c) => (
            <button key={c} type="button" disabled={pending} className="chip !flex-col !rounded-2xl !min-h-20 !justify-center text-center"
              onClick={() => run(() => addFoodAction({ date: today, category: c }))}>
              <span className="text-2xl" aria-hidden>{ICON[c]}</span>
              <span className="text-xs leading-tight">{t(`food.cat.${c}`)}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="label">{t("food.sugarToday")}</span>
        <div className="flex gap-2" role="radiogroup" aria-label={t("food.sugarToday")}>
          {(["low", "moderate", "high"] as const).map((s) => (
            <button key={s} role="radio" aria-checked={sugar === s} className="chip flex-1 justify-center" onClick={() => saveSugar(sugar === s ? null : s)}>
              {t(`food.sugar.${s}`)}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted mt-2">{t("food.noJudgement")}</p>
      </div>

      <ErrorNote code={error} />

      <div>
        <h3 className="text-xl mb-2">{t("food.todayList")}</h3>
        {todays.length === 0 ? (
          <p className="text-sm text-muted">{t("food.emptyToday")}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {todays.map((f) => (
              <li key={f.id}>
                <button className="chip" aria-label={`${t("common.delete")} ${t(`food.cat.${f.category as (typeof FOOD_CATEGORIES)[number]}`)}`}
                  onClick={() => run(() => deleteFoodAction(f.id))}>
                  {ICON[f.category]} {t(`food.cat.${f.category as (typeof FOOD_CATEGORIES)[number]}`)} <span className="text-muted">✕</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
