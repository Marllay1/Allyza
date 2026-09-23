"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { deleteMessageAction, editMessageAction, markMessagesReadAction, sendMediaMessageAction, sendStickerMessageAction, sendTextMessageAction } from "@/actions/messages";
import { AppIcon } from "@/components/icons";
import { Avatar } from "@/components/Avatar";
import { ErrorNote } from "@/components/Feedback";
import { ReactionBar } from "@/components/ReactionBar";
import { Sticker } from "@/components/Sticker";
import { STICKER_IDS, isStickerId, type StickerId } from "@/lib/stickers";
import { formatDay } from "@/lib/format";
import { isAcceptedImage, prepareImage } from "@/lib/image";
import { useI18n } from "@/lib/i18n/provider";
import type { Translator } from "@/lib/i18n/translate";
import { useReactions, type Reaction } from "@/lib/use-reactions";
import { useSignedUrls } from "@/lib/use-signed-urls";
import { useVoiceRecorder } from "@/lib/use-voice-recorder";
import { useUnread } from "@/components/AppShell";
import type { ErrCode } from "@/lib/action-utils";

export type ChatMessage = {
  id: string; author_id: string; kind: "text" | "image" | "audio" | "sticker"; body: string | null;
  storage_path: string | null; duration_ms: number | null; reply_to: string | null;
  edited_at: string | null; deleted_at: string | null; created_at: string; tmp?: boolean;
};

/** Short label for a message preview (reply quotes, etc.) that doesn't render the full content. */
function previewFor(m: ChatMessage, t: Translator): string {
  if (m.deleted_at) return t("messaging.deleted");
  if (m.kind === "text") return m.body ?? "";
  if (m.kind === "image") return t("messaging.aPhoto");
  if (m.kind === "sticker") return t("messaging.aSticker");
  return t("messaging.aVoiceNote");
}
type Person = { id: string; name: string; avatar: string | null; tone: "rose" | "gold" };

function fmtDur(ms: number) { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }

function AudioPlayer({ url, durationMs, mine }: { url: string | undefined; durationMs: number | null; mine: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!url || peaks) return;
    let cancelled = false;
    (async () => {
      try {
        const buf = await (await fetch(url)).arrayBuffer();
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AC();
        const audio = await ctx.decodeAudioData(buf.slice(0));
        const data = audio.getChannelData(0);
        const N = 32, step = Math.max(1, Math.floor(data.length / N));
        const p: number[] = [];
        for (let i = 0; i < N; i++) { let m = 0; for (let j = i * step; j < i * step + step && j < data.length; j++) m = Math.max(m, Math.abs(data[j])); p.push(Math.max(0.08, m)); }
        ctx.close().catch(() => {});
        if (!cancelled) setPeaks(p);
      } catch { if (!cancelled) setPeaks(Array.from({ length: 32 }, () => 0.25)); }
    })();
    return () => { cancelled = true; };
  }, [url, peaks]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) a.pause(); else a.play().catch(() => {});
  };

  return (
    <div className="flex items-center gap-2.5 min-w-[11rem]">
      <button type="button" onClick={toggle} className={`icon-btn shrink-0 ${mine ? "bg-white/15" : "bg-accent/15"}`} aria-label={playing ? "pause" : "play"}>
        <AppIcon name={playing ? "pause" : "play"} size={16} />
      </button>
      <div className="flex-1 h-7 flex items-center gap-[2px]">
        {(peaks ?? Array.from({ length: 32 }, () => 0.15)).map((p, i) => (
          <span key={i} className="flex-1 rounded-full" style={{ height: `${Math.round(p * 100)}%`, minHeight: 3, background: i / 32 <= progress ? (mine ? "#fff" : "var(--accent)") : mine ? "rgb(255 255 255 / .35)" : "var(--line)" }} />
        ))}
      </div>
      <span className="text-[0.68rem] tabular-nums opacity-80 shrink-0">{fmtDur(durationMs ?? 0)}</span>
      {url && (
        <audio ref={audioRef} src={url} preload="metadata"
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setProgress(0); }}
          onTimeUpdate={(e) => setProgress(e.currentTarget.duration ? e.currentTarget.currentTime / e.currentTarget.duration : 0)}
          className="hidden" />
      )}
    </div>
  );
}

export function ChatClient({ coupleId, me, other, initialMessages, initialReactions, initialCursors }: {
  coupleId: string; me: Person; other: Person;
  initialMessages: ChatMessage[]; initialReactions: Reaction[]; initialCursors: { mine: string | null; theirs: string | null };
}) {
  const { t, locale } = useI18n();
  const { markRead } = useUnread();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrCode | null>(null);
  const [typing, setTyping] = useState(false);
  const [theirCursor, setTheirCursor] = useState<string | null>(initialCursors.theirs);
  const [showJump, setShowJump] = useState(false);
  const [stickersOpen, setStickersOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const typingCh = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const lastTypingSent = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recorder = useVoiceRecorder();
  const { reactions, toggle: toggleReaction } = useReactions(coupleId, me.id, initialReactions);

  const unreadDividerAt = useMemo(() => {
    if (!initialCursors.mine) return null;
    const idx = initialMessages.findIndex((m) => m.author_id !== me.id && m.created_at > initialCursors.mine!);
    return idx >= 0 ? initialMessages[idx].id : null;
  }, [initialMessages, initialCursors.mine, me.id]);

  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  const mediaPaths = useMemo(() => messages.filter((m) => (m.kind === "image" || m.kind === "audio") && m.storage_path).map((m) => m.storage_path!), [messages]);
  const urls = useSignedUrls(mediaPaths);

  const upsert = useCallback((m: ChatMessage) => {
    setMessages((cur) => {
      if (cur.some((x) => x.id === m.id)) return cur.map((x) => (x.id === m.id ? { ...x, ...m } : x));
      const i = cur.findIndex((x) => x.tmp && x.author_id === m.author_id && x.kind === m.kind && x.body === m.body);
      const next = i >= 0 ? cur.filter((_, k) => k !== i) : [...cur];
      return [...next, m].sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
  }, []);

  const doMarkRead = useCallback(() => { markMessagesReadAction(); markRead(["message"]); }, [markRead]);

  useEffect(() => { doMarkRead(); }, [doMarkRead]);

  useEffect(() => {
    const supabase = createClient();
    const data = supabase
      .channel(`chat:${coupleId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `couple_id=eq.${coupleId}` }, (p) => {
        const m = p.new as ChatMessage;
        upsert(m);
        if (m.author_id !== me.id && document.visibilityState === "visible") doMarkRead();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `couple_id=eq.${coupleId}` }, (p) => upsert(p.new as ChatMessage))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "message_cursors", filter: `couple_id=eq.${coupleId}` }, (p) => {
        const row = p.new as { user_id: string; last_read_at: string };
        if (row.user_id === other.id) setTheirCursor(row.last_read_at);
      })
      .subscribe();

    const tCh = supabase.channel(`couple:${coupleId}`, { config: { private: true } });
    tCh.on("broadcast", { event: "typing" }, (msg) => {
      if ((msg.payload as { uid?: string })?.uid === me.id) return;
      setTyping(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(false), 3000);
    }).subscribe();
    typingCh.current = tCh;

    return () => { supabase.removeChannel(data); supabase.removeChannel(tCh); typingCh.current = null; if (typingTimer.current) clearTimeout(typingTimer.current); };
  }, [coupleId, me.id, other.id, upsert, doMarkRead]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages.length, typing]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => setShowJump(el.scrollHeight - el.scrollTop - el.clientHeight > 500);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const onType = (v: string) => {
    setText(v);
    const now = Date.now();
    if (v && now - lastTypingSent.current > 2200) { lastTypingSent.current = now; typingCh.current?.send({ type: "broadcast", event: "typing", payload: { uid: me.id } }); }
  };

  const send = async () => {
    const body = text.trim();
    const pendingFiles = files;
    if ((!body && !pendingFiles.length) || busy) return;
    setBusy(true); setError(null);
    const replyId = replyTo?.id;
    setText(""); setFiles([]); setReplyTo(null);

    if (body) {
      const tmp: ChatMessage = { id: `tmp-${crypto.randomUUID()}`, author_id: me.id, kind: "text", body, storage_path: null, duration_ms: null, reply_to: replyId ?? null, edited_at: null, deleted_at: null, created_at: new Date().toISOString(), tmp: true };
      setMessages((c) => [...c, tmp]);
      const r = await sendTextMessageAction({ body, replyTo: replyId });
      if (r.ok) upsert(r.data as ChatMessage); else { setMessages((c) => c.filter((x) => x.id !== tmp.id)); setError(r.error); }
    }
    const supabase = createClient();
    for (const f of pendingFiles) {
      try {
        const img = await prepareImage(f);
        const path = `${coupleId}/chat/${crypto.randomUUID()}.${img.ext}`;
        const up = await supabase.storage.from("couple-media").upload(path, img.blob, { contentType: img.type });
        if (up.error) throw up.error;
        const r = await sendMediaMessageAction({ kind: "image", path });
        if (r.ok) upsert(r.data as ChatMessage); else throw new Error(r.error);
      } catch { setError("generic"); }
    }
    setBusy(false);
  };

  const sendSticker = async (id: StickerId) => {
    setStickersOpen(false);
    const replyId = replyTo?.id;
    setReplyTo(null);
    const tmp: ChatMessage = { id: `tmp-${crypto.randomUUID()}`, author_id: me.id, kind: "sticker", body: id, storage_path: null, duration_ms: null, reply_to: replyId ?? null, edited_at: null, deleted_at: null, created_at: new Date().toISOString(), tmp: true };
    setMessages((c) => [...c, tmp]);
    const r = await sendStickerMessageAction({ stickerId: id, replyTo: replyId });
    if (r.ok) upsert(r.data as ChatMessage); else { setMessages((c) => c.filter((x) => x.id !== tmp.id)); setError(r.error); }
  };

  const sendVoice = async () => {
    if (!recorder.blob) return;
    setBusy(true); setError(null);
    try {
      const ext = recorder.blob.mime.includes("mp4") ? "m4a" : recorder.blob.mime.includes("aac") ? "aac" : "webm";
      const path = `${coupleId}/chat/${crypto.randomUUID()}.${ext}`;
      const supabase = createClient();
      const up = await supabase.storage.from("couple-media").upload(path, recorder.blob.blob, { contentType: recorder.blob.mime });
      if (up.error) throw up.error;
      const r = await sendMediaMessageAction({ kind: "audio", path, durationMs: recorder.blob.ms });
      if (r.ok) upsert(r.data as ChatMessage); else throw new Error(r.error);
      recorder.reset();
    } catch { setError("generic"); }
    setBusy(false);
  };

  const days = useMemo(() => {
    const out: { day: string; items: ChatMessage[] }[] = [];
    for (const m of messages) {
      const d = new Date(m.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const last = out[out.length - 1];
      if (last?.day === key) last.items.push(m); else out.push({ day: key, items: [m] });
    }
    return out;
  }, [messages]);

  const time = (iso: string) => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  const lastMineId = [...messages].reverse().find((m) => m.author_id === me.id && !m.deleted_at)?.id;

  return (
    <div className="flex flex-col">
      <div ref={scrollerRef} className="grid gap-1 pb-4 max-h-[65dvh] overflow-y-auto -mx-1 px-1">
        {messages.length === 0 && (
          <div className="text-center py-10 grid justify-items-center gap-2">
            <AppIcon name="message" size={30} className="text-muted opacity-60" />
            <p className="font-display text-2xl">{t("messaging.emptyTitle")}</p>
            <p className="text-muted text-balance max-w-xs">{t("messaging.emptyBody")}</p>
          </div>
        )}
        {days.map(({ day, items }) => (
          <div key={day} className="grid gap-1.5 py-2">
            <div className="eyebrow text-center sticky top-0 z-10 py-1">{formatDay(day, locale, { weekday: "long", day: "numeric", month: "long" })}</div>
            {items.map((m) => {
              const mine = m.author_id === me.id;
              const quoted = m.reply_to ? byId.get(m.reply_to) : null;
              const read = mine && !!theirCursor && m.created_at <= theirCursor;
              return (
                <div key={m.id} id={`msg-${m.id}`} className={`flex gap-2 items-end ${mine ? "flex-row-reverse" : ""} ${m.tmp ? "opacity-60" : ""}`}>
                  {!mine && <Avatar path={other.avatar} tone={other.tone} size={26} className="mb-1" />}
                  <div className={`group relative max-w-[78%] flex flex-col ${mine ? "items-end" : "items-start"}`}>
                    {m.id === unreadDividerAt && (
                      <div className="w-full text-center my-2"><span className="chip !cursor-default !text-[0.68rem] !min-h-7 !px-3">{t("messaging.newMessages")}</span></div>
                    )}
                    <div className={m.kind === "sticker" && !m.deleted_at ? "px-1" : `rounded-3xl px-4 py-2.5 border ${mine ? "bg-accent/18 border-accent/30 rounded-br-md" : "bg-surface2 border-line rounded-bl-md"} ${m.deleted_at ? "italic opacity-70" : ""}`}>
                      {quoted && !m.deleted_at && (
                        <button type="button" onClick={() => document.getElementById(`msg-${quoted.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                          className="block w-full text-left rounded-xl px-2.5 py-1.5 mb-1.5 border-l-2 border-accent bg-black/5 text-xs">
                          <span className="block font-medium">{quoted.author_id === me.id ? t("common.you") : other.name}</span>
                          <span className="block truncate opacity-80">{previewFor(quoted, t)}</span>
                        </button>
                      )}
                      {m.deleted_at ? (
                        <span className="inline-flex items-center gap-1.5 text-sm"><AppIcon name="trash" size={13} /> {t("messaging.deleted")}</span>
                      ) : editing?.id === m.id ? (
                        <div className="grid gap-2 min-w-52">
                          <textarea className="field !bg-transparent !border-white/20" value={editing.body} maxLength={4000} onChange={(e) => setEditing({ id: m.id, body: e.target.value })} />
                          <div className="flex gap-2">
                            <button className="btn btn-primary !min-h-9 !px-3 text-xs" onClick={async () => { const r = await editMessageAction({ id: m.id, body: editing.body }); if (r.ok) { upsert({ ...m, body: editing.body, edited_at: new Date().toISOString() }); setEditing(null); } }}>{t("common.save")}</button>
                            <button className="btn !min-h-9 !px-3 text-xs" onClick={() => setEditing(null)}>{t("common.cancel")}</button>
                          </div>
                        </div>
                      ) : m.kind === "text" ? (
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      ) : m.kind === "sticker" ? (
                        isStickerId(m.body ?? "") ? <Sticker id={m.body as StickerId} size={84} /> : null
                      ) : m.kind === "image" ? (
                        m.storage_path && urls[m.storage_path] ? (
                          <img src={urls[m.storage_path]} alt={t("messaging.aPhoto")} loading="lazy" className="rounded-2xl max-w-full max-h-72 object-cover" />
                        ) : <div className="w-40 aspect-square rounded-2xl bg-surface animate-pulse" />
                      ) : m.storage_path ? (
                        <AudioPlayer url={urls[m.storage_path]} durationMs={m.duration_ms} mine={mine} />
                      ) : null}
                      {!m.deleted_at && !editing && (
                        <div className={`flex items-center gap-1 mt-1 text-[0.62rem] opacity-70 ${mine ? "justify-end" : ""}`}>
                          {m.edited_at && <span>{t("journal.edited")}</span>}
                          <span>{time(m.created_at)}</span>
                          {mine && m.id === lastMineId && <AppIcon name={read ? "readAll" : "check"} size={13} className={read ? "text-accent" : ""} />}
                        </div>
                      )}
                    </div>
                    {!m.deleted_at && !m.tmp && (
                      <>
                        <ReactionBar targetType="message" targetId={m.id} reactions={reactions} myId={me.id} toggle={toggleReaction} />
                        <div className="flex items-center gap-1 mt-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
                          <button type="button" className="icon-btn !size-7 text-muted" aria-label={t("messaging.reply")} onClick={() => setReplyTo(m)}><AppIcon name="replyArrow" size={13} /></button>
                          <button type="button" className="icon-btn !size-7 text-muted" aria-label={t("common.copy")} onClick={() => m.body && navigator.clipboard?.writeText(m.body).catch(() => {})}><AppIcon name="copy" size={13} /></button>
                          {mine && (
                            <button type="button" className="icon-btn !size-7 text-muted" aria-label={t("common.delete")}
                              onClick={() => setOpenMenu(openMenu === m.id ? null : m.id)}><AppIcon name="trash" size={13} /></button>
                          )}
                        </div>
                        {mine && openMenu === m.id && (
                          <div className="flex gap-2 mt-1">
                            {m.kind === "text" && <button className="chip !min-h-7 !px-2.5 !text-xs" onClick={() => { setEditing({ id: m.id, body: m.body ?? "" }); setOpenMenu(null); }}><AppIcon name="edit" size={12} /> {t("common.edit")}</button>}
                            <button className="chip !min-h-7 !px-2.5 !text-xs text-danger" onClick={() => { if (confirm(t("common.confirmDelete"))) { deleteMessageAction(m.id); setOpenMenu(null); } }}><AppIcon name="trash" size={12} /> {t("common.delete")}</button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {typing && (
          <p className="text-sm text-muted italic px-2 inline-flex items-center gap-2" role="status" aria-live="polite">
            <Avatar path={other.avatar} tone={other.tone} size={18} />
            <span className="inline-flex gap-1"><i className="typing-dot" /><i className="typing-dot" /><i className="typing-dot" /></span>
          </p>
        )}
        <div ref={endRef} />
      </div>

      {showJump && (
        <button type="button" className="icon-btn glass absolute right-2 -top-2 z-10" aria-label={t("messaging.jumpToLatest")}
          onClick={() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })}><AppIcon name="down" size={18} /></button>
      )}

      <div className="sticky bottom-[calc(4.6rem+env(safe-area-inset-bottom))] card p-3 grid gap-2 z-10">
        <ErrorNote code={error} />
        {replyTo && (
          <div className="flex items-center gap-2 rounded-xl bg-surface2 px-3 py-2 text-sm">
            <AppIcon name="replyArrow" size={14} className="text-muted shrink-0" />
            <span className="flex-1 min-w-0 truncate">{previewFor(replyTo, t)}</span>
            <button type="button" className="icon-btn !size-7 shrink-0" aria-label={t("common.cancel")} onClick={() => setReplyTo(null)}><AppIcon name="close" size={13} /></button>
          </div>
        )}
        {files.length > 0 && (
          <div className="flex gap-2 overflow-x-auto">
            {files.map((f, i) => (
              <div key={i} className="relative shrink-0">
                <img src={URL.createObjectURL(f)} alt="" className="size-16 rounded-xl object-cover" />
                <button type="button" aria-label={t("common.delete")} className="absolute -top-1.5 -right-1.5 size-6 grid place-items-center rounded-full bg-surface border border-line" onClick={() => setFiles((c) => c.filter((_, k) => k !== i))}><AppIcon name="close" size={12} /></button>
              </div>
            ))}
          </div>
        )}
        {stickersOpen && (
          <div className="grid grid-cols-5 gap-1.5 max-h-40 overflow-y-auto" role="listbox" aria-label={t("messaging.stickers")}>
            {STICKER_IDS.map((id) => (
              <button key={id} type="button" onClick={() => sendSticker(id)} aria-label={t(`stickers.${id}`)}
                className="rounded-xl p-1.5 hover:bg-surface2 active:scale-95 transition">
                <Sticker id={id} size={44} />
              </button>
            ))}
          </div>
        )}

        {recorder.state === "recording" ? (
          <div className="flex items-center gap-3 px-1">
            <span className="size-2.5 rounded-full bg-danger animate-pulse" />
            <div className="flex-1 flex items-center gap-[2px] h-8">
              {recorder.levels.map((l, i) => <span key={i} className="flex-1 rounded-full bg-accent" style={{ height: `${Math.round(l * 100)}%`, minHeight: 3 }} />)}
            </div>
            <span className="tabular-nums text-sm">{fmtDur(recorder.ms)}</span>
            <button type="button" className="icon-btn text-muted" aria-label={t("common.cancel")} onClick={() => recorder.stop(true)}><AppIcon name="close" size={18} /></button>
            <button type="button" className="icon-btn bg-accent text-accent-ink" aria-label={t("messaging.stopRecording")} onClick={() => recorder.stop(false)}><AppIcon name="check" size={18} /></button>
          </div>
        ) : recorder.blob ? (
          <div className="flex items-center gap-2">
            <div className="flex-1"><AudioPlayer url={recorder.previewUrl ?? undefined} durationMs={recorder.blob.ms} mine={false} /></div>
            <button type="button" className="icon-btn text-muted" aria-label={t("common.delete")} onClick={recorder.reset}><AppIcon name="trash" size={18} /></button>
            <button type="button" className="btn btn-primary !px-4 shrink-0" onClick={sendVoice} disabled={busy} aria-label={t("common.send")}><AppIcon name="send" size={18} /></button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            {!text.trim() && files.length === 0 && (
              <>
                <label className="icon-btn cursor-pointer shrink-0" aria-label={t("messaging.attachImage")}>
                  <AppIcon name="attach" size={20} />
                  <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { const list = Array.from(e.target.files ?? []).filter(isAcceptedImage); setFiles((f) => [...f, ...list].slice(0, 6)); e.target.value = ""; }} />
                </label>
                <button type="button" className={`icon-btn shrink-0 ${stickersOpen ? "bg-accent/20 text-accent" : ""}`} aria-label={t("messaging.stickers")} aria-pressed={stickersOpen} onClick={() => setStickersOpen((o) => !o)}>
                  <AppIcon name="sparkle" size={20} />
                </button>
              </>
            )}
            <textarea className="field !min-h-12 max-h-40" rows={1} value={text} maxLength={4000}
              placeholder={t("messaging.placeholder")} aria-label={t("messaging.placeholder")}
              onChange={(e) => onType(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) { e.preventDefault(); send(); } }} />
            {text.trim() || files.length > 0 ? (
              <button type="button" className="btn btn-primary !px-4 shrink-0" onClick={send} disabled={busy} aria-label={t("common.send")}><AppIcon name="send" size={20} /></button>
            ) : recorder.supported ? (
              <button type="button" className="icon-btn shrink-0" aria-label={t("messaging.recordVoice")} onClick={recorder.start}><AppIcon name="mic" size={20} /></button>
            ) : null}
          </div>
        )}
        {recorder.state === "denied" && <p className="text-xs text-danger inline-flex items-center gap-1.5"><AppIcon name="micOff" size={13} /> {t("messaging.micDenied")}</p>}
      </div>
    </div>
  );
}
