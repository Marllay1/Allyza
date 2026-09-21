"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { deleteJournalAction, editJournalAction, postJournalAction, registerMediaAction } from "@/actions/us";
import { useI18n } from "@/lib/i18n/provider";
import { formatDay } from "@/lib/format";
import { isAcceptedImage, prepareImage } from "@/lib/image";
import { useSignedUrls } from "@/lib/use-signed-urls";
import { useReactions, type Reaction } from "@/lib/use-reactions";
import { ReactionBar } from "@/components/ReactionBar";
import { ErrorNote } from "@/components/Feedback";
import { AppIcon } from "@/components/icons";
import { useUnread } from "@/components/AppShell";
import type { ErrCode } from "@/lib/action-utils";

export type Entry = { id: string; author_id: string; body: string; created_at: string; edited_at: string | null; tmp?: boolean };
export type JMedia = { id: string; entry_id: string | null; storage_path: string; caption: string | null };

type Props = {
  coupleId: string;
  myId: string;
  herId: string;
  names: { me: string; other: string };
  initialEntries: Entry[];
  initialMedia: JMedia[];
  initialReactions: Reaction[];
};

const QUICK = ["❤️", "😘", "🥰", "✨", "🌙", "😂"];

export function JournalClient({ coupleId, myId, herId, names, initialEntries, initialMedia, initialReactions }: Props) {
  const { t, locale } = useI18n();
  const { markRead } = useUnread();
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [media, setMedia] = useState<JMedia[]>(initialMedia);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrCode | null>(null);
  const [typing, setTyping] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const typingChannel = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const lastTypingSent = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { reactions, toggle } = useReactions(coupleId, myId, initialReactions);

  const otherIsHer = herId !== myId;
  const urls = useSignedUrls(media.map((m) => m.storage_path));
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews]);

  useEffect(() => markRead(["journal"]), [markRead]);

  const upsertReal = useCallback((e: Entry) => {
    setEntries((cur) => {
      if (cur.some((x) => x.id === e.id)) return cur.map((x) => (x.id === e.id ? { ...x, ...e } : x));
      const i = cur.findIndex((x) => x.tmp && x.author_id === e.author_id && x.body === e.body);
      const next = i >= 0 ? cur.filter((_, k) => k !== i) : [...cur];
      return [...next, e].sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
  }, []);

  // Live updates: table changes (RLS-filtered) + a private channel for "is writing…".
  useEffect(() => {
    const supabase = createClient();
    const data = supabase
      .channel(`journal:${coupleId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "journal_entries", filter: `couple_id=eq.${coupleId}` }, (p) => {
        upsertReal(p.new as Entry);
        if ((p.new as Entry).author_id !== myId) markRead(["journal"]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "journal_entries", filter: `couple_id=eq.${coupleId}` }, (p) => upsertReal(p.new as Entry))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "journal_entries" }, (p) => {
        const id = (p.old as { id?: string }).id;
        if (id) setEntries((cur) => cur.filter((x) => x.id !== id));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "couple_media", filter: `couple_id=eq.${coupleId}` }, (p) => {
        const m = p.new as JMedia & { category: string };
        if (m.category === "journal" && m.entry_id) setMedia((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
      })
      .subscribe();

    const typingCh = supabase.channel(`couple:${coupleId}`, { config: { private: true } });
    typingCh
      .on("broadcast", { event: "typing" }, (msg) => {
        if ((msg.payload as { uid?: string })?.uid === myId) return;
        setTyping(true);
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTyping(false), 3500);
      })
      .subscribe();
    typingChannel.current = typingCh;

    return () => {
      supabase.removeChannel(data);
      supabase.removeChannel(typingCh);
      typingChannel.current = null;
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [coupleId, myId, upsertReal, markRead]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries.length, typing]);

  const onType = (v: string) => {
    setText(v);
    const now = Date.now();
    if (v && now - lastTypingSent.current > 2500) {
      lastTypingSent.current = now;
      typingChannel.current?.send({ type: "broadcast", event: "typing", payload: { uid: myId } });
    }
  };

  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    const tmp: Entry = { id: `tmp-${crypto.randomUUID()}`, author_id: myId, body, created_at: new Date().toISOString(), edited_at: null, tmp: true };
    setEntries((cur) => [...cur, tmp]);
    const pendingFiles = files;
    setText("");
    setFiles([]);

    const r = await postJournalAction({ body });
    if (!r.ok) {
      setEntries((cur) => cur.filter((x) => x.id !== tmp.id));
      setText(body);
      setFiles(pendingFiles);
      setError(r.error);
      setBusy(false);
      return;
    }
    const real = r.data as Entry;
    upsertReal(real);

    const supabase = createClient();
    for (const f of pendingFiles) {
      try {
        const img = await prepareImage(f);
        const path = `${coupleId}/${crypto.randomUUID()}.${img.ext}`;
        const up = await supabase.storage.from("couple-media").upload(path, img.blob, { contentType: img.type, upsert: false });
        if (up.error) throw up.error;
        const reg = await registerMediaAction({ path, category: "journal", entryId: real.id });
        if (!reg.ok) throw new Error(reg.error);
        setMedia((cur) => (cur.some((m) => m.storage_path === path) ? cur : [...cur, { id: (reg.data as { id: string }).id, entry_id: real.id, storage_path: path, caption: null }]));
      } catch {
        setError("generic");
      }
    }
    setBusy(false);
  };

  const days = useMemo(() => {
    const out: { day: string; items: Entry[] }[] = [];
    for (const e of entries) {
      const local = new Date(e.created_at);
      const key = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
      const last = out[out.length - 1];
      if (last?.day === key) last.items.push(e);
      else out.push({ day: key, items: [e] });
    }
    return out;
  }, [entries]);

  const time = (iso: string) => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  return (
    <div className="flex flex-col">
      <div className="grid gap-6 pb-4">
        {entries.length === 0 && (
          <div className="text-center py-10 grid justify-items-center gap-2">
            <AppIcon name="journal" size={30} className="text-muted opacity-60" />
            <p className="font-display text-2xl">{t("journal.emptyTitle")}</p>
            <p className="text-muted text-balance max-w-xs">{t("journal.emptyBody")}</p>
          </div>
        )}
        {days.map(({ day, items }) => (
          <div key={day} className="grid gap-3">
            <div className="eyebrow text-center">{formatDay(day, locale, { weekday: "long", day: "numeric", month: "long" })}</div>
            {items.map((e) => {
              const mine = e.author_id === myId;
              const attachments = media.filter((m) => m.entry_id === e.id);
              return (
                <article key={e.id} className={`flex flex-col ${mine ? "items-end" : "items-start"} ${e.tmp ? "opacity-60" : ""}`}>
                  <div className={`max-w-[88%] rounded-3xl px-4 py-3 border ${mine ? "bg-accent/15 border-accent/30 rounded-br-md" : "bg-surface2 border-line rounded-bl-md"}`}>
                    <div className="text-xs text-muted mb-1">{mine ? names.me : names.other} · {time(e.created_at)}{e.edited_at ? ` · ${t("journal.edited")}` : ""}</div>
                    {editing === e.id ? (
                      <div className="grid gap-2 min-w-56">
                        <textarea className="field" value={editText} onChange={(ev) => setEditText(ev.target.value)} maxLength={4000} />
                        <div className="flex gap-2">
                          <button className="btn btn-primary !min-h-10" onClick={async () => {
                            const r = await editJournalAction({ id: e.id, body: editText });
                            if (r.ok) { setEntries((cur) => cur.map((x) => (x.id === e.id ? { ...x, body: editText.trim(), edited_at: new Date().toISOString() } : x))); setEditing(null); } else setError(r.error);
                          }}>{t("common.save")}</button>
                          <button className="btn !min-h-10" onClick={() => setEditing(null)}>{t("common.cancel")}</button>
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap break-words">{e.body}</p>
                    )}
                    {attachments.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {attachments.map((m) => (
                          urls[m.storage_path]
                            ?   <img key={m.id} src={urls[m.storage_path]} alt={m.caption ?? t("journal.photo")} loading="lazy" className="rounded-2xl w-full aspect-square object-cover" />
                            : <div key={m.id} className="rounded-2xl aspect-square bg-surface animate-pulse" />
                        ))}
                      </div>
                    )}
                  </div>
                  {!e.tmp && (
                    <div className={mine ? "self-end" : "self-start"}>
                      <ReactionBar targetType="journal" targetId={e.id} reactions={reactions} myId={myId} toggle={toggle} />
                      {mine && editing !== e.id && (
                        <div className="flex gap-3 text-xs text-muted mt-1 justify-end">
                          <button className="underline underline-offset-4" onClick={() => { setEditing(e.id); setEditText(e.body); }}>{t("common.edit")}</button>
                          <button className="underline underline-offset-4" onClick={async () => {
                            if (!confirm(t("journal.confirmDelete"))) return;
                            const r = await deleteJournalAction(e.id);
                            if (r.ok) setEntries((cur) => cur.filter((x) => x.id !== e.id)); else setError(r.error);
                          }}>{t("common.delete")}</button>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ))}
        {typing && (
          <p className="text-sm text-muted italic px-2 inline-flex items-center gap-2" role="status" aria-live="polite">
            <span aria-hidden className="inline-flex gap-1"><i className="typing-dot" /><i className="typing-dot" /><i className="typing-dot" /></span>
            {otherIsHer ? t("journal.typingHer") : t("journal.typingHim")}
          </p>
        )}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-[calc(4.6rem+env(safe-area-inset-bottom))] card p-3 grid gap-2">
        <ErrorNote code={error} />
        {previews.length > 0 && (
          <div className="flex gap-2 overflow-x-auto">
            {previews.map((src, i) => (
              <div key={src} className="relative shrink-0">
                { }
                <img src={src} alt="" className="size-16 rounded-xl object-cover" />
                <button type="button" aria-label={t("common.delete")} className="absolute -top-1.5 -right-1.5 size-6 grid place-items-center rounded-full bg-surface border border-line" onClick={() => setFiles((f) => f.filter((_, k) => k !== i))}><AppIcon name="close" size={12} /></button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-1 overflow-x-auto">
          {QUICK.map((q) => (
            <button key={q} type="button" className="chip !min-h-9 !px-2.5" onClick={() => onType(text + q)}>{q}</button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <label className="btn !px-3 shrink-0 cursor-pointer" aria-label={t("journal.addPhoto")}>
            <AppIcon name="camera" size={20} />
            <input type="file" accept="image/*" multiple className="sr-only"
              onChange={(ev) => { const list = Array.from(ev.target.files ?? []).filter(isAcceptedImage); setFiles((f) => [...f, ...list].slice(0, 4)); ev.target.value = ""; }} />
          </label>
          <textarea
            className="field !min-h-12 max-h-40" rows={1} value={text} maxLength={4000}
            placeholder={t("journal.placeholder")} aria-label={t("journal.placeholder")}
            onChange={(ev) => onType(ev.target.value)}
            onKeyDown={(ev) => { if (ev.key === "Enter" && !ev.shiftKey && !("ontouchstart" in window)) { ev.preventDefault(); send(); } }}
          />
          <button type="button" className="btn btn-primary !px-4 shrink-0" onClick={send} disabled={busy || !text.trim()} aria-label={t("common.send")}><AppIcon name="send" size={20} /></button>
        </div>
      </div>
    </div>
  );
}
