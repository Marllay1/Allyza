"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addStoryAction, deleteStoryAction } from "@/actions/world";
import { AppIcon } from "@/components/icons";
import { ErrorNote } from "@/components/Feedback";
import { ReactionBar } from "@/components/ReactionBar";
import { Polaroid } from "@/features/couple/story/Polaroid";
import { EntryActions } from "@/components/ui";
import { STORY_EMOTIONS } from "@/lib/constants";
import { toISODate } from "@/lib/cycle";
import { formatDay } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { isAcceptedImage, prepareImage } from "@/lib/image";
import { useLiveRefresh } from "@/lib/use-live-refresh";
import { useDayNumber } from "@/lib/use-day-index";
import { useReactions, type Reaction } from "@/lib/use-reactions";
import { useSignedUrls } from "@/lib/use-signed-urls";
import type { ErrCode } from "@/lib/action-utils";

export type Moment = { id: string; author_id: string; moment_date: string; title: string; body: string | null; place: string | null; emotion: (typeof STORY_EMOTIONS)[number] | null; storage_path: string | null };

export function StoryClient({ coupleId, myId, moments, initialReactions, names }: { coupleId: string; myId: string; moments: Moment[]; initialReactions: Reaction[]; names: { me: string; other: string } }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<ErrCode | null>(null);
  const [adding, setAdding] = useState(false);
  const [step, setStep] = useState(0);
  const day = useDayNumber();
  const { reactions, toggle } = useReactions(coupleId, myId, initialReactions);
  useLiveRefresh("story_moments", coupleId);

  const [date, setDate] = useState(toISODate());
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [place, setPlace] = useState("");
  const [emotion, setEmotion] = useState<Moment["emotion"]>(null);
  const [file, setFile] = useState<File | null>(null);

  const urls = useSignedUrls(moments.map((m) => m.storage_path).filter(Boolean) as string[]);
  const withPhoto = moments.filter((m) => m.storage_path);
  const pool = withPhoto.length ? withPhoto : moments;
  const remembered = pool.length ? pool[(((day + step) % pool.length) + pool.length) % pool.length] : null;

  const years = useMemo(() => {
    const out: { year: string; items: Moment[] }[] = [];
    for (const m of moments) {
      const y = m.moment_date.slice(0, 4);
      const last = out[out.length - 1];
      if (last?.year === y) last.items.push(m); else out.push({ year: y, items: [m] });
    }
    return out;
  }, [moments]);

  const save = () =>
    start(async () => {
      setError(null);
      let path: string | undefined;
      if (file) {
        try {
          const img = await prepareImage(file);
          path = `${coupleId}/${crypto.randomUUID()}.${img.ext}`;
          const up = await createClient().storage.from("couple-media").upload(path, img.blob, { contentType: img.type });
          if (up.error) throw up.error;
        } catch { setError("generic"); return; }
      }
      const r = await addStoryAction({ date, title, body: body || undefined, place: place || undefined, emotion: emotion ?? undefined, path });
      if (!r.ok) { setError(r.error); return; }
      setTitle(""); setBody(""); setPlace(""); setEmotion(null); setFile(null); setAdding(false);
      router.refresh();
    });

  const who = (id: string) => (id === myId ? names.me : names.other);

  return (
    <div className="grid gap-6">
      {remembered && (
        <section className="card p-6 grid gap-4 text-center overflow-hidden">
          <button className="eyebrow inline-flex items-center gap-2 justify-self-center" onClick={() => setStep((s) => s + 1)} aria-label={t("story.another")}>
            <AppIcon name="sparkles" size={14} /> {t("story.remember")}
          </button>
          <Polaroid
            key={remembered.id}
            src={remembered.storage_path ? urls[remembered.storage_path] ?? null : undefined}
            caption={remembered.title}
            sub={formatDay(remembered.moment_date, locale, { day: "numeric", month: "long", year: "numeric" })}
            className="rise"
          />
          {remembered.body && <p className="text-muted text-balance max-w-sm mx-auto">{remembered.body}</p>}
        </section>
      )}

      <section className="card p-5 grid gap-4">
        <button className="flex items-center justify-between gap-3 text-left" onClick={() => setAdding((a) => !a)} aria-expanded={adding}>
          <span><span className="block font-display text-2xl">{t("story.addTitle")}</span><span className="text-sm text-muted">{t("story.addSub")}</span></span>
          <AppIcon name={adding ? "close" : "plus"} size={22} />
        </button>
        {adding && (
          <div className="grid gap-4 page-enter">
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <input className="field" maxLength={120} placeholder={t("story.titlePlaceholder")} value={title} onChange={(e) => setTitle(e.target.value)} aria-label={t("story.titlePlaceholder")} />
              <input type="date" className="field !w-auto" max={toISODate()} value={date} onChange={(e) => setDate(e.target.value)} aria-label={t("common.date")} />
            </div>
            <textarea className="field" maxLength={3000} placeholder={t("story.bodyPlaceholder")} value={body} onChange={(e) => setBody(e.target.value)} />
            <input className="field" maxLength={120} placeholder={t("story.placePlaceholder")} value={place} onChange={(e) => setPlace(e.target.value)} aria-label={t("story.placePlaceholder")} />
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("story.emotion")}>
              {STORY_EMOTIONS.map((em) => (
                <button key={em} role="radio" aria-checked={emotion === em} className="chip" onClick={() => setEmotion(emotion === em ? null : em)}><AppIcon name={em} size={15} /> {t(`story.emotions.${em}`)}</button>
              ))}
            </div>
            <label className="btn cursor-pointer justify-self-start">
              <AppIcon name="camera" size={18} /> {file ? file.name : t("story.addPhoto")}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] && isAcceptedImage(e.target.files[0]) ? e.target.files[0] : null)} />
            </label>
            <ErrorNote code={error} />
            <button className="btn btn-primary !min-h-14" disabled={pending || !title.trim()} onClick={save}>{t("story.save")}</button>
          </div>
        )}
      </section>

      {moments.length === 0 ? (
        <div className="text-center text-muted py-8 grid justify-items-center gap-3">
          <AppIcon name="story" size={30} className="opacity-60" />
          <p className="font-display text-2xl text-ink">{t("story.emptyTitle")}</p>
          <p className="text-balance max-w-xs">{t("story.emptyBody")}</p>
        </div>
      ) : (
        <div className="grid gap-8">
          {years.map(({ year, items }) => (
            <section key={year}>
              <h2 className="text-3xl mb-4 text-gold">{year}</h2>
              <ol className="relative ml-3 border-l border-line pl-6 grid gap-8">
                {items.map((m) => (
                  <li key={m.id} className="relative">
                    <span className="absolute -left-[31px] top-1.5 size-3 rounded-full bg-accent ring-4 ring-[var(--room-bg,var(--bg))]" />
                    <p className="eyebrow">{formatDay(m.moment_date, locale, { day: "numeric", month: "long" })} · {who(m.author_id)}</p>
                    <h3 className="text-2xl mt-1">{m.title}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                      {m.emotion && <span className="inline-flex items-center gap-1"><AppIcon name={m.emotion} size={13} /> {t(`story.emotions.${m.emotion}`)}</span>}
                      {m.place && <span className="inline-flex items-center gap-1"><AppIcon name="place" size={13} /> {m.place}</span>}
                    </div>
                    {m.body && <p className="mt-3 whitespace-pre-wrap break-words">{m.body}</p>}
                    {m.storage_path && (
                      <div className="mt-4">
                        <Polaroid src={urls[m.storage_path] ?? null} caption={m.title} sub={formatDay(m.moment_date, locale, { day: "numeric", month: "long", year: "numeric" })} tilt={(m.id.charCodeAt(0) % 5) - 2} className="!mx-0" />
                      </div>
                    )}
                    <ReactionBar targetType="story" targetId={m.id} reactions={reactions} myId={myId} toggle={toggle} />
                    {m.author_id === myId && (
                      <EntryActions onDelete={() => start(async () => { await deleteStoryAction(m.id); router.refresh(); })} editLabel={t("common.edit")} deleteLabel={t("common.delete")} confirmLabel={t("common.confirmDelete")} />
                    )}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
