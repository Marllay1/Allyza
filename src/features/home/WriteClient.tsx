"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createContentAction, deleteContentAction, updateContentAction } from "@/actions/content";
import { AppIcon, type IconName } from "@/components/icons";
import { ErrorNote } from "@/components/Feedback";
import { CUSTOM_CONTENT_CATEGORIES } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { isAcceptedImage, prepareImage } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";
import { useSignedUrls } from "@/lib/use-signed-urls";
import type { ErrCode } from "@/lib/action-utils";

type Category = (typeof CUSTOM_CONTENT_CATEGORIES)[number];
type Status = "draft" | "scheduled" | "published";
export type ContentItem = {
  id: string; category: Category; title: string | null; body: string;
  storage_path: string | null; status: Status; publish_at: string | null; created_at: string;
};

const CAT_ICON: Record<Category, IconName> = {
  note: "note", compliment: "compliment", poem: "poetry", letter: "mail", memory: "memoryKind",
  joke: "jokes", encouragement: "encouragement", open_when: "hidden", surprise: "surprise", daily: "sun",
};

const EMPTY = { category: "note" as Category, title: "", body: "", file: null as File | null, status: "draft" as Status, publishAt: "" };

export function WriteClient({ coupleId, items }: { coupleId: string; items: ContentItem[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<ErrCode | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [preview, setPreview] = useState(false);
  const [compose, setCompose] = useState(false);

  const editing = useMemo(() => items.find((i) => i.id === editingId) ?? null, [items, editingId]);
  const urls = useSignedUrls(items.map((i) => i.storage_path).filter(Boolean) as string[]);

  const startNew = () => { setEditingId(null); setForm(EMPTY); setPreview(false); setCompose(true); };
  const startEdit = (item: ContentItem) => {
    setEditingId(item.id);
    setForm({
      category: item.category, title: item.title ?? "", body: item.body, file: null,
      status: item.status, publishAt: item.publish_at ? item.publish_at.slice(0, 16) : "",
    });
    setPreview(false);
    setCompose(true);
  };

  const save = () =>
    start(async () => {
      setError(null);
      const publishAt = form.status === "scheduled" && form.publishAt ? new Date(form.publishAt).toISOString() : undefined;
      if (editingId) {
        const r = await updateContentAction({ id: editingId, category: form.category, title: form.title || undefined, body: form.body, status: form.status, publishAt });
        if (!r.ok) { setError(r.error); return; }
      } else {
        let storagePath: string | undefined;
        if (form.file) {
          try {
            const img = await prepareImage(form.file);
            storagePath = `${coupleId}/${crypto.randomUUID()}.${img.ext}`;
            const up = await createClient().storage.from("couple-media").upload(storagePath, img.blob, { contentType: img.type });
            if (up.error) throw up.error;
          } catch { setError("generic"); return; }
        }
        const r = await createContentAction({ category: form.category, title: form.title || undefined, body: form.body, storagePath, status: form.status, publishAt });
        if (!r.ok) { setError(r.error); return; }
      }
      setForm(EMPTY); setEditingId(null); setCompose(false); setPreview(false);
      router.refresh();
    });

  const remove = (id: string) =>
    start(async () => {
      setError(null);
      const r = await deleteContentAction(id);
      if (r.ok) router.refresh(); else setError(r.error);
    });

  const STATUS_ICON: Record<Status, IconName> = { draft: "edit", scheduled: "clock", published: "check" };
  const groups: { status: Status; list: ContentItem[] }[] = [
    { status: "draft", list: items.filter((i) => i.status === "draft") },
    { status: "scheduled", list: items.filter((i) => i.status === "scheduled") },
    { status: "published", list: items.filter((i) => i.status === "published") },
  ];

  return (
    <div className="grid gap-6">
      <ErrorNote code={error} />

      {!compose && (
        <button className="card p-5 flex items-center justify-between gap-3 text-left" onClick={startNew}>
          <span><span className="block font-display text-2xl">{t("write.newTitle")}</span><span className="text-sm text-muted">{t("write.newSub")}</span></span>
          <AppIcon name="plus" size={22} />
        </button>
      )}

      {compose && (
        <section className="card p-5 grid gap-4 page-enter">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl">{editing ? t("write.editTitle") : t("write.newTitle")}</h2>
            <button className="icon-btn" aria-label={t("common.cancel")} onClick={() => { setCompose(false); setEditingId(null); setForm(EMPTY); }}><AppIcon name="close" size={18} /></button>
          </div>

          <div>
            <span className="label">{t("write.category")}</span>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("write.category")}>
              {CUSTOM_CONTENT_CATEGORIES.map((c) => (
                <button key={c} role="radio" aria-checked={form.category === c} className="chip" onClick={() => setForm((f) => ({ ...f, category: c }))}>
                  <AppIcon name={CAT_ICON[c]} size={15} /> {t(`write.categories.${c}`)}
                </button>
              ))}
            </div>
          </div>

          {!preview ? (
            <>
              <input className="field" maxLength={120} placeholder={t("write.titlePlaceholder")} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              <textarea className="field !min-h-32" maxLength={4000} placeholder={t("write.bodyPlaceholder")} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />

              {!editing && (
                <label className="btn cursor-pointer justify-self-start">
                  <AppIcon name="camera" size={18} /> {form.file ? form.file.name : t("write.addPhoto")}
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] && isAcceptedImage(e.target.files[0]) ? e.target.files[0] : null }))} />
                </label>
              )}

              <div>
                <span className="label">{t("write.status")}</span>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("write.status")}>
                  {(["draft", "scheduled", "published"] as Status[]).map((s) => (
                    <button key={s} role="radio" aria-checked={form.status === s} className="chip" onClick={() => setForm((f) => ({ ...f, status: s }))}>
                      <AppIcon name={STATUS_ICON[s]} size={15} /> {t(`write.statuses.${s}`)}
                    </button>
                  ))}
                </div>
                {form.status === "scheduled" && (
                  <input type="datetime-local" className="field mt-3" value={form.publishAt} onChange={(e) => setForm((f) => ({ ...f, publishAt: e.target.value }))} aria-label={t("write.pickDateTime")} />
                )}
              </div>
            </>
          ) : (
            <div className="card p-5 bg-surface2">
              <p className="eyebrow inline-flex items-center gap-1.5"><AppIcon name={CAT_ICON[form.category]} size={13} /> {t("home.noteFromHim.label")}</p>
              {form.title && <p className="font-display text-lg mt-2">{form.title}</p>}
              <p className="font-display text-2xl leading-snug text-balance mt-2 whitespace-pre-wrap break-words">{form.body || t("write.previewEmpty")}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={() => setPreview((p) => !p)}><AppIcon name="eye" size={16} /> {preview ? t("write.editAgain") : t("write.preview")}</button>
            <button className="btn btn-primary" disabled={pending || !form.body.trim() || (form.status === "scheduled" && !form.publishAt)} onClick={save}>
              <AppIcon name="send" size={18} /> {editing ? t("common.save") : t(`write.saveAs.${form.status}`)}
            </button>
          </div>
        </section>
      )}

      {groups.map(({ status, list }) => list.length > 0 && (
        <section key={status}>
          <h2 className="text-xl mb-3 inline-flex items-center gap-1.5"><AppIcon name={STATUS_ICON[status]} size={16} /> {t(`write.statuses.${status}`)}</h2>
          <ul className="grid gap-2">
            {list.map((item) => (
              <li key={item.id} className="card p-4 flex items-center gap-3">
                {item.storage_path && urls[item.storage_path] && <img src={urls[item.storage_path]} alt="" className="size-12 rounded-xl object-cover shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="truncate">{item.title || t(`write.categories.${item.category}`)}</p>
                  <p className="text-xs text-muted truncate">
                    {item.status === "scheduled" && item.publish_at ? t("write.scheduledFor", { when: formatDateTime(item.publish_at, locale) }) : item.body}
                  </p>
                </div>
                <button className="icon-btn text-muted" aria-label={t("common.edit")} onClick={() => startEdit(item)}><AppIcon name="edit" size={18} /></button>
                <button className="icon-btn text-muted" aria-label={t("common.delete")} onClick={() => confirm(t("common.confirmDelete")) && remove(item.id)}><AppIcon name="trash" size={18} /></button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {items.length === 0 && !compose && <p className="text-muted text-center">{t("write.emptyAll")}</p>}
    </div>
  );
}
