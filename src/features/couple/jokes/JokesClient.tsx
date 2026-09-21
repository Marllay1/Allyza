"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addJokeAction, deleteJokeAction } from "@/actions/world";
import { AppIcon } from "@/components/icons";
import { ErrorNote } from "@/components/Feedback";
import { ReactionBar } from "@/components/ReactionBar";
import { JOKE_KINDS } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/provider";
import { useLiveRefresh } from "@/lib/use-live-refresh";
import { useReactions, type Reaction } from "@/lib/use-reactions";
import type { ErrCode } from "@/lib/action-utils";

export type Joke = { id: string; author_id: string; kind: (typeof JOKE_KINDS)[number]; body: string; note: string | null };

export function JokesClient({ coupleId, myId, jokes, initialReactions, names }: { coupleId: string; myId: string; jokes: Joke[]; initialReactions: Reaction[]; names: { me: string; other: string } }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<ErrCode | null>(null);
  const [kind, setKind] = useState<Joke["kind"]>("joke");
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");
  const { reactions, toggle } = useReactions(coupleId, myId, initialReactions);
  useLiveRefresh("inside_jokes", coupleId);

  return (
    <div className="grid gap-6">
      <section className="card p-5 grid gap-3">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("jokes.kind")}>
          {JOKE_KINDS.map((k) => (
            <button key={k} role="radio" aria-checked={kind === k} className="chip" onClick={() => setKind(k)}><AppIcon name={k} size={15} /> {t(`jokes.kinds.${k}`)}</button>
          ))}
        </div>
        <textarea className="field" maxLength={500} placeholder={t(`jokes.placeholder.${kind}`)} value={body} onChange={(e) => setBody(e.target.value)} />
        <input className="field" maxLength={500} placeholder={t("jokes.notePlaceholder")} value={note} onChange={(e) => setNote(e.target.value)} />
        <ErrorNote code={error} />
        <button className="btn btn-primary" disabled={pending || !body.trim()}
          onClick={() => start(async () => { setError(null); const r = await addJokeAction({ kind, body, note: note || undefined }); if (r.ok) { setBody(""); setNote(""); router.refresh(); } else setError(r.error); })}>
          {t("jokes.add")}
        </button>
      </section>

      {jokes.length === 0 ? (
        <div className="text-center text-muted py-6 grid justify-items-center gap-3">
          <AppIcon name="jokes" size={30} className="opacity-60" />
          <p className="font-display text-2xl text-ink">{t("jokes.emptyTitle")}</p>
          <p className="max-w-xs text-balance">{t("jokes.emptyBody")}</p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {jokes.map((j) => (
            <li key={j.id} className="card p-5">
              <div className="flex items-center justify-between text-xs text-muted mb-2">
                <span className="inline-flex items-center gap-1.5"><AppIcon name={j.kind} size={14} /> {t(`jokes.kinds.${j.kind}`)}</span>
                <span>{j.author_id === myId ? names.me : names.other}</span>
              </div>
              <p className="font-display text-2xl leading-snug whitespace-pre-wrap break-words">{j.body}</p>
              {j.note && <p className="text-sm text-muted mt-2 whitespace-pre-wrap">{j.note}</p>}
              <ReactionBar targetType="joke" targetId={j.id} reactions={reactions} myId={myId} toggle={toggle} />
              {j.author_id === myId && (
                <button className="text-xs text-muted underline underline-offset-4 mt-2" onClick={() => confirm(t("common.confirmDelete")) && start(async () => { await deleteJokeAction(j.id); router.refresh(); })}>{t("common.delete")}</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
