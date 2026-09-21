"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { askForLoveAction, quickCheckinAction } from "@/actions/world";
import { AppIcon, type IconName } from "@/components/icons";
import { ErrorNote } from "@/components/Feedback";
import { CHECKIN_STATES } from "@/lib/constants";
import { toISODate } from "@/lib/cycle";
import { useT } from "@/lib/i18n/provider";
import { haptic } from "@/lib/local-pref";
import type { ErrCode } from "@/lib/action-utils";

const ICON: Record<(typeof CHECKIN_STATES)[number], IconName> = { good: "ciGood", ok: "ciOk", tired: "ciTired", love: "ciLove" };

/**
 * "How are you, really?" — four answers, a few seconds, no questionnaire.
 * Nothing is saved until she says so, and nothing is ever sent to him unless she chooses to.
 */
export function CheckIn({ partnerName, hasPartner }: { partnerName: string; hasPartner: boolean }) {
  const t = useT();
  const router = useRouter();
  const [sel, setSel] = useState<(typeof CHECKIN_STATES)[number] | null>(null);
  const [done, setDone] = useState<"saved" | "sent" | null>(null);
  const [error, setError] = useState<ErrCode | null>(null);
  const [pending, start] = useTransition();

  const save = () => start(async () => {
    setError(null);
    const r = await quickCheckinAction({ date: toISODate(), state: sel! });
    if (r.ok) { setDone("saved"); router.refresh(); } else setError(r.error);
  });
  const tellHim = () => start(async () => {
    setError(null);
    const r = await askForLoveAction();
    if (r.ok) { haptic(18); setDone("sent"); } else setError(r.error);
  });

  return (
    <section className="card p-6 mb-4 rise" aria-labelledby="checkin-h">
      <h2 id="checkin-h" className="text-[1.7rem]">{t("checkin.title")}</h2>
      <div className="grid grid-cols-2 gap-2.5 mt-4" role="radiogroup" aria-labelledby="checkin-h">
        {CHECKIN_STATES.map((s) => (
          <button key={s} role="radio" aria-checked={sel === s} className="chip !min-h-14 !rounded-2xl justify-start !px-4 text-left"
            onClick={() => { setSel(s); setDone(null); setError(null); haptic(8); }}>
            <AppIcon name={ICON[s]} size={20} className={sel === s ? "text-accent" : ""} />
            <span className="leading-tight">{t(`checkin.answers.${s}`)}</span>
          </button>
        ))}
      </div>

      {sel && (
        <div className="mt-5 grid gap-3 page-enter" aria-live="polite">
          <p className="font-display text-2xl leading-snug">{t(`checkin.replies.${sel}`)}</p>
          {done === "saved" && <p className="text-good text-sm inline-flex items-center gap-1.5"><AppIcon name="check" size={16} /> {t("checkin.saved")}</p>}
          {done === "sent" && <p className="text-good text-sm inline-flex items-center gap-1.5"><AppIcon name="check" size={16} /> {t("checkin.sent", { name: partnerName })}</p>}
          <ErrorNote code={error} />
          {!done && (
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary" disabled={pending} onClick={save}>{t("checkin.save")}</button>
              {sel === "love" && hasPartner && (
                <button className="btn" disabled={pending} onClick={tellHim}><AppIcon name="us" size={16} /> {t("checkin.tell", { name: partnerName })}</button>
              )}
              <button className="btn btn-ghost" onClick={() => setSel(null)}>{t("checkin.notNow")}</button>
            </div>
          )}
          {done === "saved" && sel === "love" && hasPartner && (
            <button className="btn justify-self-start" disabled={pending} onClick={tellHim}><AppIcon name="us" size={16} /> {t("checkin.tell", { name: partnerName })}</button>
          )}
        </div>
      )}
    </section>
  );
}
