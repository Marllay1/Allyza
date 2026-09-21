"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addLittleAction, answerLittleAction, deleteLittleAction, openLittleAction } from "@/actions/us";
import { useI18n } from "@/lib/i18n/provider";
import { LITTLE_KINDS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { useReactions, type Reaction } from "@/lib/use-reactions";
import { ReactionBar } from "@/components/ReactionBar";
import { ErrorNote } from "@/components/Feedback";
import { useUnread } from "@/components/AppShell";
import type { ErrCode } from "@/lib/action-utils";

export type Little = { id: string; author_id: string; kind: (typeof LITTLE_KINDS)[number]; body: string; answer: string | null; opened_at: string | null; created_at: string };
const ICON = { compliment: "🌸", note: "💌", question: "❓", date_idea: "🌆", challenge: "🎯", hidden: "🔒" } as const;

export function LittleClient({ coupleId, myId, items, initialReactions, names }: {
  coupleId: string; myId: string; items: Little[]; initialReactions: Reaction[]; names: { me: string; other: string };
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { markRead } = useUnread();
  const { reactions, toggle } = useReactions(coupleId, myId, initialReactions);
  const [kind, setKind] = useState<Little["kind"]>("compliment");
  const [body, setBody] = useState("");
  const [error, setError] = useState<ErrCode | null>(null);
  const [answering, setAnswering] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [pending, start] = useTransition();
  const ideas = kind === "question" ? t.arr("little.ideas.question") : kind === "date_idea" ? t.arr("little.ideas.date_idea") : kind === "challenge" ? t.arr("little.ideas.challenge") : kind === "compliment" ? t.arr("little.ideas.compliment") : [];

  useEffect(() => markRead(["little"]), [markRead]);
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`little:${coupleId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "little_things", filter: `couple_id=eq.${coupleId}` }, () => router.refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [coupleId, router]);

  const run = (fn: () => Promise<{ ok: boolean; error?: ErrCode }>, after?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.ok) { after?.(); router.refresh(); } else setError(r.error ?? "generic");
    });

  return (
    <div className="grid gap-5">
      <section className="card p-4 grid gap-3">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("little.kind")}>
          {LITTLE_KINDS.map((k) => (
            <button key={k} role="radio" aria-checked={kind === k} className="chip" onClick={() => setKind(k)}>{ICON[k]} {t(`little.kinds.${k}`)}</button>
          ))}
        </div>
        <textarea className="field" maxLength={600} placeholder={t(`little.placeholder.${kind}`)} value={body} onChange={(e) => setBody(e.target.value)} />
        {ideas.length > 0 && (
          <button type="button" className="btn btn-ghost text-sm self-start" onClick={() => setBody(ideas[Math.floor(Math.random() * ideas.length)])}>✨ {t("little.inspire")}</button>
        )}
        <ErrorNote code={error} />
        <button className="btn btn-primary" disabled={pending || !body.trim()} onClick={() => run(() => addLittleAction({ kind, body }), () => setBody(""))}>
          {t("little.send")}
        </button>
      </section>

      {items.length === 0 && <p className="text-center text-muted py-8 text-balance">{t("little.empty")}</p>}

      <ul className="grid gap-3">
        {items.map((i) => {
          const mine = i.author_id === myId;
          const sealed = i.kind === "hidden" && !mine && !i.opened_at;
          return (
            <li key={i.id} className={`card p-4 ${mine ? "border-accent/30" : ""}`}>
              <div className="flex items-center justify-between text-xs text-muted mb-2">
                <span>{ICON[i.kind]} {t(`little.kinds.${i.kind}`)} · {mine ? names.me : names.other}</span>
                <span>{formatDateTime(i.created_at, locale)}</span>
              </div>
              {sealed ? (
                <button className="btn btn-primary w-full" onClick={() => run(() => openLittleAction(i.id))}>🔒 {t("little.reveal")}</button>
              ) : (
                <p className="font-display text-xl whitespace-pre-wrap break-words">{i.body}</p>
              )}
              {i.kind === "question" && !sealed && (
                <div className="mt-3">
                  {i.answer ? (
                    <p className="rounded-2xl bg-surface2 px-4 py-3 text-sm"><span className="text-muted">{t("little.answer")}: </span>{i.answer}</p>
                  ) : !mine ? (
                    answering === i.id ? (
                      <div className="grid gap-2">
                        <textarea className="field" value={answer} maxLength={600} onChange={(e) => setAnswer(e.target.value)} />
                        <button className="btn btn-primary" disabled={pending || !answer.trim()} onClick={() => run(() => answerLittleAction({ id: i.id, answer }), () => { setAnswering(null); setAnswer(""); })}>{t("little.sendAnswer")}</button>
                      </div>
                    ) : (
                      <button className="btn" onClick={() => setAnswering(i.id)}>{t("little.answerCta")}</button>
                    )
                  ) : (
                    <p className="text-xs text-muted">{t("little.awaitingAnswer")}</p>
                  )}
                </div>
              )}
              {!sealed && <ReactionBar targetType="little" targetId={i.id} reactions={reactions} myId={myId} toggle={toggle} />}
              {mine && (
                <button className="text-xs text-muted underline underline-offset-4 mt-2" onClick={() => confirm(t("common.confirmDelete")) && run(() => deleteLittleAction(i.id))}>{t("common.delete")}</button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
