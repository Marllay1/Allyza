"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { deleteJournalAction, editJournalAction, postJournalAction, registerMediaAction } from "@/actions/us";
import { AppIcon, type IconName } from "@/components/icons";
import { Avatar } from "@/components/Avatar";
import { ErrorNote } from "@/components/Feedback";
import { EntryActions } from "@/components/ui";
import { ReactionBar } from "@/components/ReactionBar";
import { useUnread } from "@/components/AppShell";
import { formatDay } from "@/lib/format";
import { isAcceptedImage, prepareImage } from "@/lib/image";
import { useI18n } from "@/lib/i18n/provider";
import { useReactions, type Reaction } from "@/lib/use-reactions";
import { useSignedUrls } from "@/lib/use-signed-urls";
import { toISODate } from "@/lib/cycle";
import type { ErrCode } from "@/lib/action-utils";

const MOODS = ["joy", "love", "calm", "tender", "nostalgia", "tired", "grateful"] as const;
type Mood = (typeof MOODS)[number];

export type Page = { id: string; author_id: string; title: string | null; body: string; mood: Mood | null; created_at: string; edited_at: string | null };
export type PageMedia = { id: string; entry_id: string | null; storage_path: string };

/** "Our Journal": a shared notebook — pages you write, not messages you send. */
export function NotebookClient({ coupleId, myId, initialPages, initialMedia, initialReactions, people }: {
  coupleId: string; myId: string; initialPages: Page[]; initialMedia: PageMedia[]; initialReactions: Reaction[];
  people: Record<string, { name: string; avatar: string | null; tone: "rose" | "gold" }>;
}) {
  const { t, locale } = useI18n();
  const [pages, setPages] = useState<Page[]>(initialPages);
  const [media, setMedia] = useState<PageMedia[]>(initialMedia);
  const [composing, setComposing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mood, setMood] = useState<Mood | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrCode | null>(null);
  const { reactions, toggle } = useReactions(coupleId, myId, initialReactions);
  const { markRead } = useUnread();

  // Opening the notebook is what reads it: persisted server-side, so it survives reloads and other devices.
  useEffect(() => markRead(["journal"]), [markRead]);

  const urls = useSignedUrls(media.map((m) => m.storage_path));
  const byEntry = useMemo(() => { const m = new Map<string, PageMedia>(); for (const x of media) if (x.entry_id) m.set(x.entry_id, x); return m; }, [media]);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`notebook:${coupleId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "journal_entries", filter: `couple_id=eq.${coupleId}` }, (p) => {
        const e = p.new as Page; setPages((cur) => (cur.some((x) => x.id === e.id) ? cur : [e, ...cur]));
        if (e.author_id !== myId) markRead(["journal"]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "journal_entries", filter: `couple_id=eq.${coupleId}` }, (p) => {
        const e = p.new as Page; setPages((cur) => cur.map((x) => (x.id === e.id ? e : x)));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "journal_entries" }, (p) => {
        const id = (p.old as { id?: string }).id; if (id) setPages((cur) => cur.filter((x) => x.id !== id));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "couple_media", filter: `couple_id=eq.${coupleId}` }, (p) => {
        const m = p.new as PageMedia & { category: string };
        if (m.category === "journal" && m.entry_id) setMedia((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [coupleId, myId, markRead]);

  const resetComposer = () => { setComposing(false); setEditingId(null); setTitle(""); setBody(""); setMood(null); setFile(null); setError(null); };

  const startEdit = (p: Page) => { setEditingId(p.id); setComposing(true); setTitle(p.title ?? ""); setBody(p.body); setMood(p.mood); setFile(null); };

  const save = async () => {
    if (!body.trim() || busy) return;
    setBusy(true); setError(null);
    if (editingId) {
      const r = await editJournalAction({ id: editingId, body: body.trim(), title, mood });
      if (r.ok) { setPages((cur) => cur.map((x) => (x.id === editingId ? { ...x, body: body.trim(), title: title || null, mood, edited_at: new Date().toISOString() } : x))); resetComposer(); }
      else setError(r.error);
      setBusy(false);
      return;
    }
    const r = await postJournalAction({ body: body.trim(), title: title || undefined, mood: mood ?? undefined });
    if (!r.ok) { setError(r.error); setBusy(false); return; }
    const created = r.data as Page;
    setPages((cur) => [created, ...cur]);
    if (file) {
      try {
        const img = await prepareImage(file);
        const path = `${coupleId}/${crypto.randomUUID()}.${img.ext}`;
        const supabase = createClient();
        const up = await supabase.storage.from("couple-media").upload(path, img.blob, { contentType: img.type });
        if (up.error) throw up.error;
        const reg = await registerMediaAction({ path, category: "journal", entryId: created.id, takenOn: toISODate() });
        if (reg.ok) setMedia((cur) => [...cur, { id: (reg.data as { id: string }).id, entry_id: created.id, storage_path: path }]);
      } catch { setError("generic"); }
    }
    resetComposer();
    setBusy(false);
  };

  const del = async (id: string) => {
    const r = await deleteJournalAction(id);
    if (r.ok) setPages((cur) => cur.filter((x) => x.id !== id));
  };

  const years = useMemo(() => {
    const out: { key: string; items: Page[] }[] = [];
    for (const p of pages) {
      const key = formatDay(p.created_at.slice(0, 10), locale, { month: "long", year: "numeric" });
      const last = out[out.length - 1];
      if (last?.key === key) last.items.push(p); else out.push({ key, items: [p] });
    }
    return out;
  }, [pages, locale]);

  return (
    <div className="grid gap-6">
      <section className="card p-5 grid gap-3">
        {!composing ? (
          <button type="button" onClick={() => setComposing(true)} className="flex items-center gap-3 text-left">
            <span className="grid place-items-center size-11 rounded-2xl bg-accent/15 text-accent shrink-0"><AppIcon name="penLine" size={20} /></span>
            <span>
              <span className="block font-display text-2xl">{t("notebook.newPage")}</span>
              <span className="block text-sm text-muted">{t("notebook.newPageSub")}</span>
            </span>
          </button>
        ) : (
          <div className="grid gap-3 page-enter">
            <input className="field font-display text-xl" maxLength={120} placeholder={t("notebook.titlePlaceholder")} value={title} onChange={(e) => setTitle(e.target.value)} aria-label={t("notebook.titlePlaceholder")} />
            <textarea className="field !min-h-40" maxLength={4000} placeholder={t("notebook.bodyPlaceholder")} value={body} onChange={(e) => setBody(e.target.value)} autoFocus />
            <div>
              <span className="label">{t("notebook.mood")}</span>
              <div className="flex flex-wrap gap-2">
                {MOODS.map((m) => (
                  <button key={m} type="button" className="chip" aria-pressed={mood === m} onClick={() => setMood(mood === m ? null : m)}>
                    <AppIcon name={m as IconName} size={14} /> {t(`notebook.moods.${m}`)}
                  </button>
                ))}
              </div>
            </div>
            {!editingId && (
              <label className="btn cursor-pointer justify-self-start">
                <AppIcon name="camera" size={18} /> {file ? file.name : t("notebook.addPhoto")}
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] && isAcceptedImage(e.target.files[0]) ? e.target.files[0] : null)} />
              </label>
            )}
            <ErrorNote code={error} />
            <div className="flex gap-2">
              <button className="btn btn-primary flex-1" disabled={busy || !body.trim()} onClick={save}>{t("notebook.save")}</button>
              <button className="btn" onClick={resetComposer}>{t("common.cancel")}</button>
            </div>
          </div>
        )}
      </section>

      {pages.length === 0 ? (
        <div className="text-center text-muted py-10 grid justify-items-center gap-2">
          <AppIcon name="journal" size={30} className="opacity-60" />
          <p className="font-display text-2xl text-ink">{t("notebook.emptyTitle")}</p>
          <p className="max-w-xs text-balance">{t("notebook.emptyBody")}</p>
        </div>
      ) : (
        <div className="grid gap-7">
          {years.map(({ key, items }) => (
            <section key={key}>
              <h2 className="text-2xl mb-3 text-gold capitalize">{key}</h2>
              <div className="grid gap-4">
                {items.map((p) => {
                  const author = people[p.author_id];
                  const img = byEntry.get(p.id);
                  return (
                    <article key={p.id} className="card p-5">
                      <div className="flex items-center gap-2.5 mb-2">
                        <Avatar path={author?.avatar ?? null} tone={author?.tone ?? "rose"} size={26} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{author?.name}</p>
                          <p className="eyebrow">{formatDay(p.created_at.slice(0, 10), locale, { weekday: "long", day: "numeric", month: "long" })}{p.edited_at ? ` · ${t("journal.edited")}` : ""}</p>
                        </div>
                        {p.mood && <span className="chip !cursor-default !min-h-8"><AppIcon name={p.mood as IconName} size={13} /> {t(`notebook.moods.${p.mood}`)}</span>}
                      </div>
                      {p.title && <h3 className="font-display text-2xl mb-1.5">{p.title}</h3>}
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{p.body}</p>
                      {img && (
                        urls[img.storage_path]
                          ? <img src={urls[img.storage_path]} alt="" loading="lazy" className="mt-3 rounded-2xl w-full max-h-96 object-cover" />
                          : <div className="mt-3 rounded-2xl w-full h-56 bg-surface2 animate-pulse" />
                      )}
                      <ReactionBar targetType="journal" targetId={p.id} reactions={reactions} myId={myId} toggle={toggle} />
                      {p.author_id === myId && (
                        <EntryActions onEdit={() => startEdit(p)} onDelete={() => del(p.id)} editLabel={t("common.edit")} deleteLabel={t("common.delete")} confirmLabel={t("journal.confirmDelete")} />
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
