"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addSongAction, deleteSongAction } from "@/actions/world";
import { AppIcon } from "@/components/icons";
import { ErrorNote } from "@/components/Feedback";
import { ReactionBar } from "@/components/ReactionBar";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { useLiveRefresh } from "@/lib/use-live-refresh";
import { useReactions, type Reaction } from "@/lib/use-reactions";
import type { ErrCode } from "@/lib/action-utils";

export type Song = { id: string; author_id: string; title: string; artist: string; url: string | null; message: string | null; created_at: string };

/** Songs are just title + artist + an optional link, so any streaming service (or none) works. */
export function MusicClient({ coupleId, myId, songs, initialReactions, names }: { coupleId: string; myId: string; songs: Song[]; initialReactions: Reaction[]; names: { me: string; other: string } }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<ErrCode | null>(null);
  const [f, setF] = useState({ title: "", artist: "", url: "", message: "" });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const { reactions, toggle } = useReactions(coupleId, myId, initialReactions);
  useLiveRefresh("shared_songs", coupleId);

  return (
    <div className="grid gap-6">
      <section className="card p-5 grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <input className="field" maxLength={120} placeholder={t("music.titlePlaceholder")} value={f.title} onChange={(e) => set("title", e.target.value)} aria-label={t("music.titlePlaceholder")} />
          <input className="field" maxLength={120} placeholder={t("music.artistPlaceholder")} value={f.artist} onChange={(e) => set("artist", e.target.value)} aria-label={t("music.artistPlaceholder")} />
        </div>
        <input className="field" type="url" inputMode="url" maxLength={500} placeholder={t("music.urlPlaceholder")} value={f.url} onChange={(e) => set("url", e.target.value)} aria-label={t("music.urlPlaceholder")} />
        <textarea className="field !min-h-20" maxLength={500} placeholder={t("music.messagePlaceholder")} value={f.message} onChange={(e) => set("message", e.target.value)} />
        <ErrorNote code={error} />
        <button className="btn btn-primary" disabled={pending || !f.title.trim() || !f.artist.trim()}
          onClick={() => start(async () => { setError(null); const r = await addSongAction(f); if (r.ok) { setF({ title: "", artist: "", url: "", message: "" }); router.refresh(); } else setError(r.error); })}>
          <AppIcon name="song" size={18} /> {t("music.add")}
        </button>
      </section>

      {songs.length === 0 ? (
        <div className="text-center text-muted py-6 grid justify-items-center gap-3">
          <AppIcon name="song" size={30} className="opacity-60" />
          <p className="font-display text-2xl text-ink">{t("music.emptyTitle")}</p>
          <p className="max-w-xs text-balance">{t("music.emptyBody")}</p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {songs.map((s) => (
            <li key={s.id} className="card p-5">
              <div className="flex items-start gap-4">
                <span className="grid place-items-center size-12 rounded-2xl bg-accent/15 text-accent shrink-0"><AppIcon name="song" size={22} /></span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-2xl leading-tight">{s.title}</h3>
                  <p className="text-muted">{s.artist}</p>
                </div>
                {s.url && (
                  <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="icon-btn text-accent" aria-label={t("music.listen")}><AppIcon name="external" size={20} /></a>
                )}
              </div>
              <p className="mt-3 font-display italic text-lg text-gold">{t("music.reminded")}</p>
              {s.message && <p className="mt-1 whitespace-pre-wrap break-words">{s.message}</p>}
              <p className="text-xs text-muted mt-2">{s.author_id === myId ? names.me : names.other} · {formatDateTime(s.created_at, locale)}</p>
              <ReactionBar targetType="song" targetId={s.id} reactions={reactions} myId={myId} toggle={toggle} />
              {s.author_id === myId && (
                <button className="text-xs text-muted underline underline-offset-4 mt-2" onClick={() => confirm(t("common.confirmDelete")) && start(async () => { await deleteSongAction(s.id); router.refresh(); })}>{t("common.delete")}</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
