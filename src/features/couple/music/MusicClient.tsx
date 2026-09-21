"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addSongAction, deleteSongAction } from "@/actions/world";
import { AppIcon } from "@/components/icons";
import { ErrorNote } from "@/components/Feedback";
import { ReactionBar } from "@/components/ReactionBar";
import { IDEA_SONGS, OUR_SONGS, spotifySearch, youtubeSearch, type PlaylistSong } from "@/features/couple/music/playlist";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { useLiveRefresh } from "@/lib/use-live-refresh";
import { useReactions, type Reaction } from "@/lib/use-reactions";
import type { ErrCode } from "@/lib/action-utils";

export type Song = { id: string; author_id: string; title: string; artist: string; url: string | null; message: string | null; created_at: string };

function PlaylistRow({ song, onDedicate }: { song: PlaylistSong; onDedicate: (s: PlaylistSong) => void }) {
  const { t } = useI18n();
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
      <span className="grid place-items-center size-10 rounded-2xl bg-accent/15 text-accent shrink-0"><AppIcon name="song" size={18} /></span>
      <span className="flex-1 min-w-[10rem]">
        <span className="block font-display text-xl leading-tight">{song.title}</span>
        <span className="block text-sm text-muted">{song.artist}</span>
      </span>
      <span className="flex items-center gap-1.5">
        <a href={youtubeSearch(song)} target="_blank" rel="noopener noreferrer" className="chip !min-h-9 !px-3 text-xs" aria-label={`${t("music.listenOn", { service: "YouTube" })}: ${song.title}`}>
          <AppIcon name="play" size={13} /> YouTube
        </a>
        <a href={spotifySearch(song)} target="_blank" rel="noopener noreferrer" className="chip !min-h-9 !px-3 text-xs" aria-label={`${t("music.listenOn", { service: "Spotify" })}: ${song.title}`}>
          <AppIcon name="external" size={13} /> Spotify
        </a>
        <button type="button" className="chip !min-h-9 !px-3 text-xs" onClick={() => onDedicate(song)} aria-label={`${t("music.dedicate")}: ${song.title}`}>
          <AppIcon name="us" size={13} /> {t("music.dedicate")}
        </button>
      </span>
    </li>
  );
}

/** Songs are just title + artist + an optional link, so any streaming service (or none) works. */
export function MusicClient({ coupleId, myId, songs, initialReactions, names }: { coupleId: string; myId: string; songs: Song[]; initialReactions: Reaction[]; names: { me: string; other: string } }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<ErrCode | null>(null);
  const [f, setF] = useState({ title: "", artist: "", url: "", message: "" });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const { reactions, toggle } = useReactions(coupleId, myId, initialReactions);
  const formRef = useRef<HTMLElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  useLiveRefresh("shared_songs", coupleId);

  // "Dedicate" pre-fills the share form: it only becomes a shared memory once a word is added and it is sent.
  const dedicate = (s: PlaylistSong) => {
    setF({ title: s.title, artist: s.artist, url: "", message: "" });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => messageRef.current?.focus({ preventScroll: true }), 350);
  };

  return (
    <div className="grid gap-6">
      {/* the playlist that comes with Allyza */}
      <section className="card p-5" aria-labelledby="playlist-h">
        <h2 id="playlist-h" className="text-2xl">{t("music.playlistTitle")}</h2>
        <p className="text-sm text-muted mt-1">{t("music.playlistSub")}</p>
        <h3 className="eyebrow mt-4 flex items-center gap-1.5"><AppIcon name="us" size={13} /> {t("music.ours")}</h3>
        <ul className="divide-y divide-line">
          {OUR_SONGS.map((s) => <PlaylistRow key={`${s.artist}-${s.title}`} song={s} onDedicate={dedicate} />)}
        </ul>
        <details className="group mt-3">
          <summary className="cursor-pointer list-none flex items-center justify-between gap-3 py-2 font-medium">
            <span className="inline-flex items-center gap-2"><AppIcon name="sparkles" size={16} /> {t("music.ideas", { n: IDEA_SONGS.length })}</span>
            <AppIcon name="down" size={18} className="transition-transform duration-300 group-open:rotate-180" />
          </summary>
          <ul className="divide-y divide-line">
            {IDEA_SONGS.map((s) => <PlaylistRow key={`${s.artist}-${s.title}`} song={s} onDedicate={dedicate} />)}
          </ul>
        </details>
        <p className="text-xs text-muted mt-3">{t("music.searchNote")}</p>
      </section>

      <section ref={formRef} className="card p-5 grid gap-3" aria-labelledby="share-h">
        <h2 id="share-h" className="text-2xl">{t("music.shareTitle")}</h2>
        <div className="grid grid-cols-2 gap-3">
          <input className="field" maxLength={120} placeholder={t("music.titlePlaceholder")} value={f.title} onChange={(e) => set("title", e.target.value)} aria-label={t("music.titlePlaceholder")} />
          <input className="field" maxLength={120} placeholder={t("music.artistPlaceholder")} value={f.artist} onChange={(e) => set("artist", e.target.value)} aria-label={t("music.artistPlaceholder")} />
        </div>
        <input className="field" type="url" inputMode="url" maxLength={500} placeholder={t("music.urlPlaceholder")} value={f.url} onChange={(e) => set("url", e.target.value)} aria-label={t("music.urlPlaceholder")} />
        <textarea ref={messageRef} className="field !min-h-20" maxLength={500} placeholder={t("music.messagePlaceholder")} value={f.message} onChange={(e) => set("message", e.target.value)} />
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
                <a href={s.url ?? youtubeSearch(s)} target="_blank" rel="noopener noreferrer nofollow" className="icon-btn text-accent" aria-label={t("music.listen")}><AppIcon name="external" size={20} /></a>
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
