"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { deleteMessageAction, editMessageAction, markMessagesReadAction, sendMediaMessageAction, sendStickerMessageAction, sendTextMessageAction } from "@/actions/messages";
import { AppIcon } from "@/components/icons";
import { Avatar } from "@/components/Avatar";
import { Portal } from "@/components/Portal";
import { ErrorNote } from "@/components/Feedback";
import { ReactionBar } from "@/components/ReactionBar";
import { MessageMenu, PressTarget, type Anchor, type MenuAction } from "@/features/messaging/MessageMenu";
import { Sticker } from "@/components/Sticker";
import { STICKER_IDS, isStickerId, type StickerId } from "@/lib/stickers";
import { formatDay } from "@/lib/format";
import { isAcceptedImage, prepareImage } from "@/lib/image";
import { useI18n } from "@/lib/i18n/provider";
import type { Translator } from "@/lib/i18n/translate";
import { useReactions, type Reaction } from "@/lib/use-reactions";
import { useSignedUrls } from "@/lib/use-signed-urls";
import { playSfx } from "@/lib/sfx";
import { useCall } from "@/features/calls/CallProvider";
import { PhotoViewer } from "@/features/messaging/PhotoViewer";
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
  const [menu, setMenu] = useState<{ id: string; anchor: Anchor } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrCode | null>(null);
  const [typing, setTyping] = useState(false);
  const [theirCursor, setTheirCursor] = useState<string | null>(initialCursors.theirs);
  const [showJump, setShowJump] = useState(false);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const typingCh = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const lastTypingSent = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recorder = useVoiceRecorder();
  // The microphone belongs to the call while one is going: a voice note must neither start nor keep recording then.
  const { inCall } = useCall();
  const { state: recState, stop: stopRecorder } = recorder;
  useEffect(() => { if (inCall && recState === "recording") stopRecorder(true); }, [inCall, recState, stopRecorder]);
  const { reactions, toggle: toggleReaction } = useReactions(coupleId, me.id, initialReactions);

  const unreadDividerAt = useMemo(() => {
    if (!initialCursors.mine) return null;
    const idx = initialMessages.findIndex((m) => m.author_id !== me.id && m.created_at > initialCursors.mine!);
    return idx >= 0 ? initialMessages[idx].id : null;
  }, [initialMessages, initialCursors.mine, me.id]);

  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  const mediaPaths = useMemo(() => messages.filter((m) => (m.kind === "image" || m.kind === "audio") && m.storage_path).map((m) => m.storage_path!), [messages]);
  const urls = useSignedUrls(mediaPaths);
  const photoItems = useMemo(() => messages.filter((m) => m.kind === "image" && !m.deleted_at && m.storage_path && urls[m.storage_path]), [messages, urls]);
  const viewerIdx = viewer ? photoItems.findIndex((m) => m.id === viewer) : -1;

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
        if (m.author_id !== me.id && document.visibilityState === "visible") { doMarkRead(); playSfx("received"); }
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

    // A phone that slept or lost the network missed the live events: fetch what arrived meanwhile.
    const catchUp = async () => {
      if (document.visibilityState !== "visible") return;
      const known = messagesRef.current.filter((m) => !m.tmp).map((m) => m.created_at).sort().at(-1);
      let q = supabase.from("messages").select("id, author_id, kind, body, storage_path, duration_ms, reply_to, edited_at, deleted_at, created_at").order("created_at", { ascending: true }).limit(100);
      if (known) q = q.gt("created_at", known);
      const { data: fresh } = await q;
      if (!fresh?.length) return;
      fresh.forEach((m) => upsert(m as ChatMessage));
      if (fresh.some((m) => m.author_id !== me.id)) doMarkRead();
    };
    document.addEventListener("visibilitychange", catchUp);
    window.addEventListener("online", catchUp);

    return () => { document.removeEventListener("visibilitychange", catchUp); window.removeEventListener("online", catchUp); supabase.removeChannel(data); supabase.removeChannel(tCh); typingCh.current = null; if (typingTimer.current) clearTimeout(typingTimer.current); };
  }, [coupleId, me.id, other.id, upsert, doMarkRead]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages.length, typing]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let lastTop = el.scrollTop;
    let touching = false;
    const onScroll = () => {
      setShowJump(el.scrollHeight - el.scrollTop - el.clientHeight > 500);
      // Reading back through older messages: put the keyboard away so the composer settles at the bottom.
      if (touching && el.scrollTop < lastTop - 6 && document.activeElement instanceof HTMLTextAreaElement) document.activeElement.blur();
      lastTop = el.scrollTop;
    };
    const down = () => { touching = true; };
    const up = () => { touching = false; };
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("touchstart", down, { passive: true });
    el.addEventListener("touchend", up, { passive: true });
    el.addEventListener("touchcancel", up, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("touchstart", down);
      el.removeEventListener("touchend", up);
      el.removeEventListener("touchcancel", up);
    };
  }, []);

  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 128)}px`;
  }, [text]);

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
      playSfx("sent");
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
        if (r.ok) { upsert(r.data as ChatMessage); playSfx("sent"); } else throw new Error(r.error);
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
    playSfx("sent");
    const r = await sendStickerMessageAction({ stickerId: id, replyTo: replyId });
    if (r.ok) upsert(r.data as ChatMessage); else { setMessages((c) => c.filter((x) => x.id !== tmp.id)); setError(r.error); }
  };

  const sendVoice = async () => {
    if (!recorder.blob) return;
    if (recorder.blob.blob.size < 200) { recorder.reset(); return; }
    setBusy(true); setError(null);
    try {
      const ext = recorder.blob.mime.includes("mp4") ? "m4a" : recorder.blob.mime.includes("aac") ? "aac" : "webm";
      const path = `${coupleId}/chat/${crypto.randomUUID()}.${ext}`;
      const supabase = createClient();
      const up = await supabase.storage.from("couple-media").upload(path, recorder.blob.blob, { contentType: recorder.blob.mime.split(";")[0] });
      if (up.error) throw up.error;
      const r = await sendMediaMessageAction({ kind: "audio", path, durationMs: recorder.blob.ms });
      if (r.ok) { upsert(r.data as ChatMessage); playSfx("sent"); } else throw new Error(r.error);
      recorder.reset();
    } catch { setError("generic"); }
    setBusy(false);
  };

  const openMenuFor = (m: ChatMessage, el: HTMLElement) => {
    if (m.tmp || m.deleted_at) return;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.getSelection()?.removeAllRanges();
    const r = el.getBoundingClientRect();
    setMenu({ id: m.id, anchor: { top: r.top, bottom: r.bottom, left: r.left, right: r.right } });
  };
  const menuMsg = menu ? byId.get(menu.id) ?? null : null;
  const menuActions: MenuAction[] = menuMsg
    ? [
        "reply",
        ...(menuMsg.kind === "text" ? (["copy"] as MenuAction[]) : []),
        ...(menuMsg.author_id === me.id && menuMsg.kind === "text" ? (["edit"] as MenuAction[]) : []),
        ...(menuMsg.author_id === me.id ? (["delete"] as MenuAction[]) : []),
      ]
    : [];
  const runAction = (a: MenuAction) => {
    const m = menuMsg;
    setMenu(null);
    if (!m) return;
    if (a === "reply") setReplyTo(m);
    else if (a === "copy") { if (m.body) navigator.clipboard?.writeText(m.body).catch(() => {}); }
    else if (a === "edit") { if (m.author_id === me.id) setEditing({ id: m.id, body: m.body ?? "" }); }
    else if (a === "delete") { if (m.author_id === me.id) setConfirmDelete(m.id); }
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

  // The background appears once there's something to look at; before that, the plain room tint stays.
  const hasMessages = messages.length > 0;
  const bgStyle: React.CSSProperties | undefined = hasMessages
    ? {
        backgroundImage: "url('/assets/messaging/background.jpg'), linear-gradient(160deg, var(--mauve), var(--accent) 55%, var(--rose))",
        backgroundSize: "cover, cover",
        backgroundPosition: "center, center",
      }
    : undefined;

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      {hasMessages && (
        <>
          <div aria-hidden className="absolute inset-0 pointer-events-none" style={bgStyle} />
          <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to bottom, color-mix(in srgb, var(--bg) 66%, transparent), color-mix(in srgb, var(--bg) 46%, transparent) 40%, color-mix(in srgb, var(--bg) 72%, transparent))" }} />
        </>
      )}
      <div ref={scrollerRef} className="relative flex-1 min-h-0 overflow-y-auto grid gap-1 content-start px-3 pb-3">
        {messages.length === 0 && (
          <div className="m-auto text-center py-10 grid justify-items-center gap-2">
            <AppIcon name="message" size={30} className="text-muted opacity-60" />
            <p className="font-display text-2xl">{t("messaging.emptyTitle")}</p>
          </div>
        )}
        {days.map(({ day, items }) => (
          <div key={day} className="grid gap-1.5 py-2">
            <div className="eyebrow text-center sticky top-0 z-10 py-1">{formatDay(day, locale, { weekday: "long", day: "numeric", month: "long" })}</div>
            {items.map((m, ix) => {
              // Photos sent together (same sender, within two minutes) share one card, like a chat gallery.
              const isImg = (x?: ChatMessage) => !!x && x.kind === "image" && !x.deleted_at && !x.tmp && !!x.storage_path;
              const near = (a: ChatMessage, b: ChatMessage) => isImg(a) && isImg(b) && a.author_id === b.author_id && Date.parse(b.created_at) - Date.parse(a.created_at) < 120_000;
              if (ix > 0 && near(items[ix - 1], m)) return null;
              const group = [m];
              if (isImg(m)) for (let k = ix + 1; k < items.length && near(items[k - 1], items[k]); k++) group.push(items[k]);
              const photoCard = isImg(m);
              const last = group[group.length - 1];
              const mine = m.author_id === me.id;
              const quoted = m.reply_to ? byId.get(m.reply_to) : null;
              const read = mine && !!theirCursor && last.created_at <= theirCursor;
              return (
                <div key={m.id} id={`msg-${m.id}`} className={`flex items-end ${mine ? "flex-row-reverse gap-2" : "gap-1.5 -ml-2"} ${m.tmp ? "opacity-60" : ""}`}>
                  {!mine && <Avatar path={other.avatar} tone={other.tone} size={26} className="mb-1" />}
                  <div className={`group relative max-w-[78%] flex flex-col ${mine ? "items-end" : "items-start"}`}>
                    {group.some((g) => g.id === unreadDividerAt) && (
                      <div className="w-full text-center my-2"><span className="chip !cursor-default !text-[0.68rem] !min-h-7 !px-3">{t("messaging.newMessages")}</span></div>
                    )}
                    <PressTarget disabled={!!editing || !!m.tmp || !!m.deleted_at || photoCard} onLongPress={(el) => openMenuFor(m, el)} style={{ userSelect: "none" }}
                      className={`${(m.kind === "sticker" && !m.deleted_at) || photoCard ? "px-1" : `rounded-3xl px-4 py-2.5 border ${mine ? "bg-accent/18 border-accent/30 rounded-br-md" : "bg-surface2 border-line rounded-bl-md"} ${m.deleted_at ? "italic opacity-70" : ""}`} ${menu?.id === m.id ? "ring-2 ring-accent/60" : ""}`}>
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
                      ) : photoCard ? (
                        <div className={`grid gap-1.5 w-[min(72vw,19rem)] ${group.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                          {group.slice(0, 4).map((g, gi) => {
                            const more = gi === 3 && group.length > 4 ? group.length - 4 : 0;
                            return (
                              <PressTarget key={g.id} onLongPress={(el) => openMenuFor(g, el)} className={`relative overflow-hidden rounded-2xl bg-surface2 ${group.length === 1 ? "" : "aspect-square"} ${menu?.id === g.id ? "ring-2 ring-accent/60" : ""}`}>
                                {urls[g.storage_path!] ? (
                                  <button type="button" className="block size-full" onClick={() => setViewer(g.id)} aria-label={t("messaging.aPhoto")}>
                                    <img src={urls[g.storage_path!]} alt={t("messaging.aPhoto")} loading="lazy" draggable={false}
                                      className={`w-full object-cover ${group.length === 1 ? "max-h-96 min-h-40" : "size-full"}`} />
                                    {more > 0 && <span className="absolute inset-0 grid place-items-center bg-black/45 text-white text-2xl font-display">+{more}</span>}
                                  </button>
                                ) : <div className="w-full aspect-square animate-pulse" />}
                              </PressTarget>
                            );
                          })}
                        </div>
                      ) : m.kind === "image" ? (
                        <div className="w-40 aspect-square rounded-2xl bg-surface animate-pulse" />
                      ) : m.storage_path ? (
                        <AudioPlayer url={urls[m.storage_path]} durationMs={m.duration_ms} mine={mine} />
                      ) : null}
                      {!m.deleted_at && !editing && (
                        <div className={`flex items-center gap-1 mt-1 text-[0.62rem] opacity-70 ${mine ? "justify-end" : ""}`}>
                          {m.edited_at && <span>{t("journal.edited")}</span>}
                          <span>{time(m.created_at)}</span>
                          {mine && last.id === lastMineId && <AppIcon name={read ? "readAll" : "check"} size={13} className={read ? "text-accent" : ""} />}
                        </div>
                      )}
                    </PressTarget>
                    {!m.deleted_at && !m.tmp && (
                      <>
                        {group.map((g) => <ReactionBar key={g.id} targetType="message" targetId={g.id} reactions={reactions} myId={me.id} toggle={toggleReaction} showAdd={false} />)}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {viewerIdx >= 0 && (
          <PhotoViewer urls={photoItems.map((m) => urls[m.storage_path!])} index={viewerIdx} onIndex={(i) => setViewer(photoItems[i].id)} onClose={() => setViewer(null)} />
        )}
        {typing && (
          <p className="text-sm text-muted italic px-2 inline-flex items-center gap-2" role="status" aria-live="polite">
            <Avatar path={other.avatar} tone={other.tone} size={18} />
            <span className="inline-flex gap-1"><i className="typing-dot" /><i className="typing-dot" /><i className="typing-dot" /></span>
          </p>
        )}
        <div ref={endRef} />
      </div>

      {showJump && (
        <button type="button" className="icon-btn glass absolute right-3 top-3 z-20" aria-label={t("messaging.jumpToLatest")}
          onClick={() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })}><AppIcon name="down" size={18} /></button>
      )}

      <div className="relative z-20 shrink-0 border-t border-line px-2.5 pt-2 pb-[max(0.5rem,var(--sab,env(safe-area-inset-bottom)))] grid gap-1.5" style={{ background: "color-mix(in srgb, var(--surface) 92%, transparent)", backdropFilter: "blur(14px)" }}>
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
            <button type="button" className="btn btn-primary !min-h-10 !px-3.5 shrink-0" aria-label={t("messaging.stopRecording")} onClick={() => recorder.stop(false)}><AppIcon name="check" size={18} /></button>
          </div>
        ) : recorder.blob ? (
          <div className="flex items-center gap-2">
            <div className="flex-1"><AudioPlayer url={recorder.previewUrl ?? undefined} durationMs={recorder.blob.ms} mine={false} /></div>
            <button type="button" className="icon-btn !size-10 shrink-0 text-muted" aria-label={t("common.delete")} onClick={recorder.reset}><AppIcon name="trash" size={18} /></button>
            <button type="button" className="btn btn-primary !min-h-10 !px-3.5 shrink-0" onClick={sendVoice} disabled={busy} aria-label={t("common.send")}><AppIcon name="send" size={19} /></button>
          </div>
        ) : (
          <div className="flex items-end gap-1.5">
            {!text.trim() && files.length === 0 && (
              <div className="flex items-center shrink-0">
                <label className="icon-btn !size-10 cursor-pointer" aria-label={t("messaging.attachImage")}>
                  <AppIcon name="attach" size={20} />
                  <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { const list = Array.from(e.target.files ?? []).filter(isAcceptedImage); setFiles((f) => [...f, ...list].slice(0, 6)); e.target.value = ""; }} />
                </label>
                <button type="button" className={`icon-btn !size-10 ${stickersOpen ? "bg-accent/20 text-accent" : ""}`} aria-label={t("messaging.stickers")} aria-pressed={stickersOpen} onClick={() => setStickersOpen((o) => !o)}>
                  <AppIcon name="sparkle" size={20} />
                </button>
              </div>
            )}
            <textarea ref={inputRef} className="field !min-h-11 !py-2.5 !rounded-3xl !resize-none flex-1 min-w-0 max-h-32" rows={1} value={text} maxLength={4000}
              placeholder={t("messaging.placeholder")} aria-label={t("messaging.placeholder")}
              onChange={(e) => onType(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) { e.preventDefault(); send(); } }} />
            {text.trim() || files.length > 0 ? (
              <button type="button" className="btn btn-primary !min-h-10 !px-3.5 shrink-0" onClick={send} disabled={busy} aria-label={t("common.send")}><AppIcon name="send" size={19} /></button>
            ) : recorder.supported ? (
              <button type="button" className="icon-btn !size-10 shrink-0" aria-label={t("messaging.recordVoice")} disabled={inCall} onClick={() => { if (!inCall) void recorder.start(); }}><AppIcon name="mic" size={20} /></button>
            ) : null}
          </div>
        )}
        {recorder.state === "denied" && <p className="text-xs text-danger inline-flex items-center gap-1.5"><AppIcon name="micOff" size={13} /> {t("messaging.micDenied")}</p>}
      </div>

      {menu && menuMsg && (
        <MessageMenu
          anchor={menu.anchor} mine={menuMsg.author_id === me.id} actions={menuActions}
          myReactions={new Set(reactions.filter((r) => r.target_id === menuMsg.id && r.author_id === me.id).map((r) => r.emoji))}
          onReact={(emoji) => { toggleReaction("message", menuMsg.id, emoji); setMenu(null); }}
          onAction={runAction} onClose={() => setMenu(null)}
        />
      )}

      {confirmDelete && (
        <Portal>
          <div role="alertdialog" aria-modal="true" aria-labelledby="del-msg-h" className="fixed inset-0 z-50 grid place-items-center p-6 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmDelete(null)}>
            <div className="card w-full max-w-xs p-6 text-center grid gap-4 pop-in" onClick={(e) => e.stopPropagation()}>
              <div>
                <h2 id="del-msg-h" className="text-2xl">{t("messaging.deleteTitle")}</h2>
                <p className="text-sm text-muted mt-1">{t("messaging.deleteNote")}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="btn" onClick={() => setConfirmDelete(null)}>{t("common.cancel")}</button>
                <button type="button" className="btn btn-primary" onClick={async () => {
                  const id = confirmDelete; setConfirmDelete(null);
                  const r = await deleteMessageAction(id);
                  if (r.ok) setMessages((cur) => cur.map((x) => (x.id === id ? { ...x, deleted_at: new Date().toISOString(), body: null, storage_path: null } : x)));
                  else setError(r.error);
                }}>{t("common.delete")}</button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
