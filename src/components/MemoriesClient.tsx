"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { deleteMediaAction, registerMediaAction, updateCaptionAction } from "@/actions/us";
import { useI18n } from "@/lib/i18n/provider";
import { MEDIA_CATEGORIES } from "@/lib/constants";
import { formatDay } from "@/lib/format";
import { isAcceptedImage, prepareImage } from "@/lib/image";
import { toISODate } from "@/lib/cycle";
import { useSignedUrls } from "@/lib/use-signed-urls";
import { useReactions, type Reaction } from "@/lib/use-reactions";
import { ReactionBar } from "@/components/ReactionBar";
import { ErrorNote } from "@/components/Feedback";
import { useUnread } from "@/components/AppShell";
import type { ErrCode } from "@/lib/action-utils";

export type Photo = { id: string; author_id: string; category: string; storage_path: string; caption: string | null; taken_on: string; created_at: string };
type Cat = (typeof MEDIA_CATEGORIES)[number];

export function MemoriesClient({ coupleId, myId, initial, initialReactions, names }: {
  coupleId: string; myId: string; initial: Photo[]; initialReactions: Reaction[]; names: { me: string; other: string };
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { markRead } = useUnread();
  // Server list (refreshed on demand) + live changes layered on top of it.
  const [extra, setExtra] = useState<Photo[]>([]);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [captions, setCaptions] = useState<Record<string, string | null>>({});
  const photos = useMemo(
    () =>
      [...extra.filter((e) => !initial.some((i) => i.id === e.id)), ...initial]
        .filter((p) => !removed.has(p.id))
        .map((p) => (p.id in captions ? { ...p, caption: captions[p.id] } : p)),
    [initial, extra, removed, captions],
  );
  const [cat, setCat] = useState<Cat | "all">("all");
  const [uploadCat, setUploadCat] = useState<Cat>("moments");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrCode | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const { reactions, toggle } = useReactions(coupleId, myId, initialReactions);

  useEffect(() => markRead(["media"]), [markRead]);

  // Live: new photos from the other partner appear without a refresh.
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`media:${coupleId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "couple_media", filter: `couple_id=eq.${coupleId}` }, (p) => {
        const m = p.new as Photo;
        if (m.category !== "journal") setExtra((cur) => (cur.some((x) => x.id === m.id) ? cur : [m, ...cur]));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "couple_media" }, (p) => {
        const id = (p.old as { id?: string }).id;
        if (id) setRemoved((cur) => new Set(cur).add(id));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [coupleId]);

  const shown = useMemo(() => photos.filter((p) => cat === "all" || p.category === cat), [photos, cat]);
  const urls = useSignedUrls(shown.map((p) => p.storage_path));
  const current = shown.find((p) => p.id === open) ?? null;
  const idx = current ? shown.indexOf(current) : -1;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight" && idx < shown.length - 1) setOpen(shown[idx + 1].id);
      if (e.key === "ArrowLeft" && idx > 0) setOpen(shown[idx - 1].id);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, idx, shown]);

  const upload = async (list: File[]) => {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    for (const f of list.filter(isAcceptedImage).slice(0, 10)) {
      try {
        const img = await prepareImage(f);
        const path = `${coupleId}/${crypto.randomUUID()}.${img.ext}`;
        const up = await supabase.storage.from("couple-media").upload(path, img.blob, { contentType: img.type });
        if (up.error) throw up.error;
        const r = await registerMediaAction({ path, category: uploadCat, takenOn: toISODate() });
        if (!r.ok) throw new Error(r.error);
      } catch {
        setError("generic");
      }
    }
    setBusy(false);
    router.refresh();
  };

  const catLabel = (c: string) => t(`memories.cat.${c as Cat}`);

  return (
    <>
      <div className="grid gap-3 mb-5">
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label={t("couple.memories")}>
          {(["all", ...MEDIA_CATEGORIES] as const).map((c) => (
            <button key={c} aria-pressed={cat === c} className="chip shrink-0" onClick={() => setCat(c)}>
              {c === "all" ? t("memories.all") : catLabel(c)}
            </button>
          ))}
        </div>
        <div className="card p-3 flex flex-wrap items-center gap-2">
          <select className="field !w-auto !min-h-11 flex-1" value={uploadCat} onChange={(e) => setUploadCat(e.target.value as Cat)} aria-label={t("memories.chooseCategory")}>
            {MEDIA_CATEGORIES.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}
          </select>
          <label className={`btn btn-primary cursor-pointer ${busy ? "opacity-60 pointer-events-none" : ""}`}>
            {busy ? t("common.loading") : `📷 ${t("memories.add")}`}
            <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { upload(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
          </label>
        </div>
        <ErrorNote code={error} />
      </div>

      {shown.length === 0 ? (
        <p className="text-center text-muted py-12 text-balance">{t("memories.empty")}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {shown.map((p) => (
            <li key={p.id}>
              <button className="block w-full aspect-square overflow-hidden rounded-2xl bg-surface2" onClick={() => { setOpen(p.id); setCaption(p.caption ?? ""); }} aria-label={p.caption ?? formatDay(p.taken_on, locale)}>
                {urls[p.storage_path]
                  ?   <img src={urls[p.storage_path]} alt={p.caption ?? ""} loading="lazy" className="size-full object-cover transition hover:scale-105" />
                  : <span className="block size-full animate-pulse" />}
              </button>
            </li>
          ))}
        </ul>
      )}

      {current && (
        <div role="dialog" aria-modal="true" aria-label={t("memories.viewer")} className="fixed inset-0 z-50 bg-black/90 flex flex-col text-white">
          <div className="flex items-center justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <span className="text-sm opacity-80">{catLabel(current.category)} · {formatDay(current.taken_on, locale, { day: "numeric", month: "long", year: "numeric" })} · {current.author_id === myId ? names.me : names.other}</span>
            <button className="size-11 rounded-full bg-white/10" aria-label={t("common.close")} onClick={() => setOpen(null)}>✕</button>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center relative px-2">
            {idx > 0 && <button className="absolute left-1 z-10 size-11 rounded-full bg-white/10" aria-label={t("common.previous")} onClick={() => setOpen(shown[idx - 1].id)}>‹</button>}
            {urls[current.storage_path]
              ?   <img src={urls[current.storage_path]} alt={current.caption ?? ""} className="max-h-full max-w-full object-contain rounded-xl" />
              : <span className="animate-pulse">…</span>}
            {idx < shown.length - 1 && <button className="absolute right-1 z-10 size-11 rounded-full bg-white/10" aria-label={t("common.next")} onClick={() => setOpen(shown[idx + 1].id)}>›</button>}
          </div>
          <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] grid gap-3 bg-gradient-to-t from-black to-transparent">
            {current.author_id === myId ? (
              <div className="flex gap-2">
                <input className="field !bg-white/10 !text-white" value={caption} maxLength={300} placeholder={t("memories.captionPlaceholder")} onChange={(e) => setCaption(e.target.value)} />
                <button className="btn" onClick={async () => { await updateCaptionAction({ id: current.id, caption }); setCaptions((c) => ({ ...c, [current.id]: caption || null })); }}>{t("common.save")}</button>
              </div>
            ) : (
              current.caption && <p className="text-center">{current.caption}</p>
            )}
            <ReactionBar targetType="media" targetId={current.id} reactions={reactions} myId={myId} toggle={toggle} />
            {current.author_id === myId && (
              <button className="btn btn-ghost btn-danger self-start" onClick={async () => {
                if (!confirm(t("memories.confirmDelete"))) return;
                const r = await deleteMediaAction(current.id);
                if (r.ok) { setRemoved((c) => new Set(c).add(current.id)); setOpen(null); }
              }}>{t("common.delete")}</button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
