"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { deleteRefugeMessageAction, openRefugeMessageAction, sendRefugeMessageAction } from "@/actions/us";
import { useI18n } from "@/lib/i18n/provider";
import { formatDateTime } from "@/lib/format";
import { ErrorNote } from "@/components/Feedback";
import { AppIcon } from "@/components/icons";
import { EntryActions } from "@/components/ui";
import { useUnread } from "@/components/AppShell";
import type { ErrCode } from "@/lib/action-utils";

export type Msg = { id: string; author_id: string; body: string; opened_at: string | null; created_at: string };

/** "Leave her a little note": a small sealed note in the Refuge — distinct from the live Messaging chat. */
export function LittleNoteClient({ coupleId, myId, msgs, names, canSend }: { coupleId: string; myId: string; msgs: Msg[]; names: { other: string }; canSend: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { markRead } = useUnread();
  const [body, setBody] = useState("");
  const [error, setError] = useState<ErrCode | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  useEffect(() => markRead(["refuge"]), [markRead]);
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`rmsg:${coupleId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "refuge_messages", filter: `couple_id=eq.${coupleId}` }, () => router.refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [coupleId, router]);

  return (
    <div className="grid gap-5">
      {canSend && (
        <section className="card p-4 grid gap-3">
          <textarea className="field" maxLength={600} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("refuge.messagePlaceholder")} aria-label={t("refuge.messagePlaceholder")} />
          <ErrorNote code={error} />
          <button className="btn btn-primary" disabled={pending || !body.trim()}
            onClick={() => start(async () => { setError(null); const r = await sendRefugeMessageAction({ body }); if (r.ok) { setBody(""); router.refresh(); } else setError(r.error); })}>
            <AppIcon name="send" size={18} /> {t("common.send")}
          </button>
        </section>
      )}
      {msgs.length === 0 && (
        <div className="text-center text-muted py-8 grid justify-items-center gap-2">
          <AppIcon name="mail" size={28} className="opacity-60" />
          <p className="text-balance max-w-xs">{t("refuge.messagesEmpty")}</p>
        </div>
      )}
      <ul className="grid gap-3">
        {msgs.map((m) => {
          const mine = m.author_id === myId;
          const sealed = !mine && !m.opened_at && !revealed.has(m.id);
          return (
            <li key={m.id} className={`card p-4 ${mine ? "border-accent/30" : ""}`}>
              <div className="text-xs text-muted mb-2">{mine ? t("common.you") : names.other} · {formatDateTime(m.created_at, locale)}</div>
              {sealed ? (
                <button className="btn btn-primary w-full !min-h-16 text-lg" onClick={() => { setRevealed((s) => new Set(s).add(m.id)); openRefugeMessageAction(m.id); markRead(["refuge"]); }}>
                  <AppIcon name="mail" size={22} /> {t("refuge.openMessage")}
                </button>
              ) : (
                <p className="font-display text-2xl leading-snug whitespace-pre-wrap break-words rise">{m.body}</p>
              )}
              {mine && (
                <EntryActions onDelete={() => start(async () => { await deleteRefugeMessageAction(m.id); router.refresh(); })} deleteLabel={t("common.delete")} confirmLabel={t("common.confirmDelete")} />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
