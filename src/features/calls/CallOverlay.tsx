"use client";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { AppIcon } from "@/components/icons";
import { Portal } from "@/components/Portal";
import { useSpeaking } from "@/features/calls/use-speaking";
import { useI18n } from "@/lib/i18n/provider";

export type CallPhase = "outgoing" | "incoming" | "connecting" | "connected" | "ended";
export type CallPerson = { id: string; name: string; avatar: string | null; tone: "rose" | "gold" };

export type OverlayProps = {
  phase: CallPhase;
  kind: "audio" | "video";
  other: CallPerson;
  ringing: boolean;
  reconnecting: boolean;
  elapsed: number;
  notice: string | null;
  muted: boolean;
  cameraOff: boolean;
  remoteCameraOff: boolean;
  remoteMuted: boolean;
  facingUser: boolean;
  canSwitchOutput: boolean;
  speakerOn: boolean;
  canRetry: boolean;
  onRedial: () => void;
  onCloseEnded: () => void;
  minimized: boolean;
  onMinimize: () => void;
  onExpand: () => void;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onAccept: () => void;
  onDecline: () => void;
  onHangup: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onFlipCamera: () => void;
  onCycleOutput: () => void;
};

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Attaches a MediaStream and keeps it playing: some browsers pause a video whose tracks arrive late. */
function StreamVideo({ stream, muted, mirror, className }: { stream: MediaStream | null; muted?: boolean; mirror?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (v.srcObject !== stream) v.srcObject = stream;
    const play = () => { void v.play().catch(() => {}); };
    const onVisible = () => { if (document.visibilityState === "visible") play(); };
    play();
    stream?.addEventListener("addtrack", play);
    v.addEventListener("loadedmetadata", play);
    document.addEventListener("visibilitychange", onVisible);
    return () => { stream?.removeEventListener("addtrack", play); v.removeEventListener("loadedmetadata", play); document.removeEventListener("visibilitychange", onVisible); };
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} data-stream={muted ? "muted" : "audible"} className={className} style={mirror ? { transform: "scaleX(-1)" } : undefined} />;
}

function RoundButton({ label, active, onClick, children, danger, good, big }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode; danger?: boolean; good?: boolean; big?: boolean }) {
  const tone = danger ? "bg-danger text-white" : good ? "bg-good text-white" : active ? "bg-white text-[#3b1f52]" : "bg-white/15 text-white backdrop-blur-xl border border-white/15";
  return (
    <button type="button" onClick={onClick} aria-label={label} aria-pressed={active}
      className={`${big ? "size-16" : "size-14"} rounded-full grid place-items-center transition duration-200 active:scale-90 motion-reduce:transition-none ${tone}`}>
      {children}
    </button>
  );
}

/* ── the floating self-view ─────────────────────────────────────────────── */

type Corner = "tl" | "tr" | "bl" | "br";
const PIP_W = 112, PIP_H = 150, EDGE = 16, TOP_CLEAR = 104, BOTTOM_CLEAR = 168;

function cornerPos(c: Corner, vw: number, vh: number) {
  return {
    x: c.endsWith("l") ? EDGE : vw - PIP_W - EDGE,
    y: c.startsWith("t") ? TOP_CLEAR : vh - PIP_H - BOTTOM_CLEAR,
  };
}

/**
 * A real floating preview: drag it anywhere, it settles into the nearest corner, and a tap
 * swaps it with the main view. It's anchored by corner, so rotating the phone keeps it tidy.
 */
function FloatingPreview({ stream, muted, mirror, off, fallback, onSwap, label }: { stream: MediaStream | null; muted: boolean; mirror: boolean; off: boolean; fallback: React.ReactNode; onSwap: () => void; label: string }) {
  const [corner, setCorner] = useState<Corner>("tr");
  const [pos, setPos] = useState(() => cornerPos("tr", window.innerWidth, window.innerHeight));
  const [dragging, setDragging] = useState(false);
  const grab = useRef<{ dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(null);

  useEffect(() => {
    const onResize = () => setPos(cornerPos(corner, window.innerWidth, window.innerHeight));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [corner]);

  return (
    <div role="button" tabIndex={0} aria-label={label}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSwap(); }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        grab.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, sx: e.clientX, sy: e.clientY, moved: false };
        setDragging(true);
      }}
      onPointerMove={(e) => {
        const g = grab.current;
        if (!g) return;
        if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) > 6) g.moved = true;
        if (g.moved) setPos({ x: Math.min(Math.max(4, e.clientX - g.dx), window.innerWidth - PIP_W - 4), y: Math.min(Math.max(4, e.clientY - g.dy), window.innerHeight - PIP_H - 4) });
      }}
      onPointerUp={() => {
        const g = grab.current;
        grab.current = null;
        setDragging(false);
        if (!g?.moved) { onSwap(); return; }
        const vw = window.innerWidth, vh = window.innerHeight;
        const cx = pos.x + PIP_W / 2, cy = pos.y + PIP_H / 2;
        const next: Corner = `${cy < vh / 2 ? "t" : "b"}${cx < vw / 2 ? "l" : "r"}`;
        setCorner(next);
        setPos(cornerPos(next, vw, vh));
      }}
      onPointerCancel={() => { grab.current = null; setDragging(false); }}
      className={`absolute z-20 touch-none select-none overflow-hidden rounded-[28px] border border-white/25 bg-[#1c1240] shadow-[0_18px_40px_-12px_rgba(0,0,0,0.65)] ring-1 ring-black/20 ${dragging ? "scale-[1.04] cursor-grabbing" : "cursor-grab transition-[left,top,transform] duration-300 ease-[cubic-bezier(.2,.9,.3,1.1)] motion-reduce:transition-none"}`}
      style={{ left: pos.x, top: pos.y, width: PIP_W, height: PIP_H }}>
      <StreamVideo stream={stream} muted={muted} mirror={mirror} className={`size-full object-cover transition-opacity duration-300 ${off ? "opacity-0" : "opacity-100"}`} />
      {off && <div className="absolute inset-0 grid place-items-center bg-[#1c1240]/90">{fallback}</div>}
    </div>
  );
}


/* ── the call shrunk to a floating palette ──────────────────────────────── */

const MINI_W = 112, MINI_H = 156, MINI_EDGE = 12, TAB_W = 30;

/**
 * The same live call, just smaller: it plays the same streams (so the voice never stops), can be dragged
 * anywhere, and pushed against a screen edge where only a small arrow stays visible to bring it back.
 */
function MiniCall({ p, status, remoteHasVideo }: { p: OverlayProps; status: string | null; remoteHasVideo: boolean }) {
  const { t } = useI18n();
  const video = p.kind === "video";
  const [pos, setPos] = useState(() => ({ x: window.innerWidth - MINI_W - MINI_EDGE, y: 84 }));
  const [docked, setDocked] = useState<"l" | "r" | null>(null);
  const [dragging, setDragging] = useState(false);
  const grab = useRef<{ dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(null);
  const clampY = (y: number) => Math.min(Math.max(48, y), window.innerHeight - MINI_H - 96);

  const x = docked === "l" ? -MINI_W - 8 : docked === "r" ? window.innerWidth + 8 : pos.x;
  return (
    <>
      <div
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          grab.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, sx: e.clientX, sy: e.clientY, moved: false };
          setDragging(true);
        }}
        onPointerMove={(e) => {
          const g = grab.current;
          if (!g) return;
          if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) > 6) g.moved = true;
          if (g.moved) setPos({ x: Math.min(Math.max(-MINI_W * 0.7, e.clientX - g.dx), window.innerWidth - MINI_W * 0.3), y: clampY(e.clientY - g.dy) });
        }}
        onPointerUp={() => {
          const g = grab.current;
          grab.current = null;
          setDragging(false);
          if (!g?.moved) { p.onExpand(); return; }
          const vw = window.innerWidth;
          if (pos.x < -MINI_W * 0.3) { setDocked("l"); return; }
          if (pos.x + MINI_W > vw + MINI_W * 0.3) { setDocked("r"); return; }
          setPos((c) => ({ x: c.x + MINI_W / 2 < vw / 2 ? MINI_EDGE : vw - MINI_W - MINI_EDGE, y: clampY(c.y) }));
        }}
        onPointerCancel={() => { grab.current = null; setDragging(false); }}
        className={`fixed z-[60] touch-none select-none overflow-hidden rounded-[24px] border border-white/25 bg-[#24123f] text-white shadow-[0_18px_40px_-12px_rgba(0,0,0,0.65)] ${dragging ? "scale-[1.04] cursor-grabbing" : "cursor-grab transition-[left,top,transform] duration-300 motion-reduce:transition-none"}`}
        style={{ left: x, top: pos.y, width: MINI_W, height: MINI_H, background: "radial-gradient(120% 90% at 30% 10%, #4a2a66 0%, #24123f 60%, #120a2a 100%)" }}
        role="button" tabIndex={docked ? -1 : 0} aria-label={t("call.expand")}
        onKeyDown={(e) => { if (e.key === "Enter") p.onExpand(); }}>
        {/* the remote voice (and picture, on a video call) keeps playing here, whatever is on screen */}
        <StreamVideo stream={p.remoteStream} className={video && remoteHasVideo ? "absolute inset-0 size-full object-cover" : "absolute size-px opacity-0 pointer-events-none"} />
        {!(video && remoteHasVideo) && <div className="absolute inset-0 grid place-items-center pb-9"><Avatar path={p.other.avatar} tone={p.other.tone} size={56} /></div>}
        <p className="absolute inset-x-0 top-0 px-2 pt-1.5 text-center text-[0.68rem] tabular-nums bg-gradient-to-b from-black/55 to-transparent" role="status">{status}</p>
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 pb-1.5 pt-4 bg-gradient-to-t from-black/60 to-transparent" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
          <button type="button" aria-label={t("call.mute")} aria-pressed={p.muted} onClick={p.onToggleMute}
            className={`size-8 rounded-full grid place-items-center ${p.muted ? "bg-white text-[#3b1f52]" : "bg-white/20"}`}><AppIcon name={p.muted ? "micOff" : "mic"} size={15} /></button>
          <button type="button" aria-label={t("call.end")} onClick={p.onHangup} className="size-8 rounded-full grid place-items-center bg-danger"><AppIcon name="callEnd" size={15} /></button>
        </div>
      </div>
      {docked && (
        <button type="button" aria-label={t("call.expand")} onClick={() => { setDocked(null); setPos((c) => ({ x: docked === "l" ? MINI_EDGE : window.innerWidth - MINI_W - MINI_EDGE, y: clampY(c.y) })); }}
          className={`fixed z-[60] h-16 grid place-items-center text-white bg-[#3b1f52]/90 border border-white/25 shadow-lg backdrop-blur ${docked === "l" ? "left-0 rounded-r-2xl border-l-0" : "right-0 rounded-l-2xl border-r-0"}`}
          style={{ width: TAB_W, top: pos.y + MINI_H / 2 - 32 }}>
          <AppIcon name={docked === "l" ? "forward" : "back"} size={20} />
        </button>
      )}
    </>
  );
}

/* ── the screen ─────────────────────────────────────────────────────────── */

export function CallOverlay(p: OverlayProps) {
  const { t } = useI18n();
  const video = p.kind === "video";
  const live = p.phase === "connected" || p.phase === "connecting";
  // The talking glow taps the remote audio through a second audio context, which can mute it on iOS: off.
  const speaking = useSpeaking(null);
  const [swapped, setSwapped] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [bump, setBump] = useState(0);
  const autoHide = video && p.phase === "connected";

  // Controls fade out while you're just watching, and come back on any touch.
  useEffect(() => {
    if (!autoHide) return;
    const id = setTimeout(() => setShowControls(false), 4500);
    return () => clearTimeout(id);
  }, [autoHide, bump, showControls]);
  const controlsVisible = !autoHide || showControls;

  const remoteHasVideo = video && !p.remoteCameraOff && (p.remoteStream?.getVideoTracks().length ?? 0) > 0;
  const status =
    p.phase === "ended" ? p.notice
    : p.phase === "incoming" ? t(video ? "call.incomingVideo" : "call.incomingAudio", { name: p.other.name })
    : p.reconnecting ? t("call.reconnecting")
    : p.phase === "connected" ? clock(p.elapsed)
    : p.phase === "connecting" ? t("call.connecting")
    : p.ringing ? t("call.ringing") : t("call.calling");

  const showPreview = video && !!p.localStream && (p.phase === "connecting" || p.phase === "connected" || p.phase === "outgoing");
  // Main view = the other person. Tap the floating self-view to swap.
  const mainIsLocal = swapped && showPreview;
  const bigStream = mainIsLocal ? p.localStream : p.remoteStream;
  const bigHasVideo = mainIsLocal ? !p.cameraOff : remoteHasVideo;

  const avatarStage = (
    <div className="grid justify-items-center gap-3 text-center">
      <div className="relative">
        {!p.phase.startsWith("ended") && (p.phase === "incoming" || p.phase === "outgoing" || speaking) && (
          <>
            <span aria-hidden className="absolute inset-0 rounded-full bg-white/15 animate-ping motion-reduce:hidden" style={{ animationDuration: speaking ? "1.2s" : "2.2s" }} />
            <span aria-hidden className={`absolute -inset-3 rounded-full border transition ${speaking ? "border-white/60 scale-105" : "border-white/15"}`} />
          </>
        )}
        <div className="relative"><Avatar path={p.other.avatar} tone={p.other.tone} size={132} /></div>
      </div>
    </div>
  );

  // Minimised: same call, same streams, only the screen changes.
  if (p.minimized && p.phase !== "incoming") return <Portal><MiniCall p={p} status={status} remoteHasVideo={remoteHasVideo} /></Portal>;

  return (
    <Portal>
      <div role="dialog" aria-modal="true" aria-label={t(video ? "call.videoCall" : "call.audioCall")}
        onPointerDown={() => { setShowControls(true); setBump((b) => b + 1); document.querySelectorAll<HTMLVideoElement>("[role=dialog] video").forEach((v) => { if (v.paused) void v.play().catch(() => {}); }); }}
        className="fixed inset-0 z-[60] overflow-hidden text-white"
        style={{ background: "radial-gradient(120% 90% at 30% 10%, #4a2a66 0%, #24123f 45%, #120a2a 100%)" }}>

        {/* main view: the other person's video, or their portrait when there is no picture to show */}
        <div className="absolute inset-0 grid place-items-center">{!(bigHasVideo && live) && avatarStage}</div>
        {video && live && (
          <StreamVideo stream={bigStream} muted={mainIsLocal} mirror={mainIsLocal && p.facingUser}
            className={`absolute inset-0 size-full object-cover transition-opacity duration-500 ${bigHasVideo ? "opacity-100" : "opacity-0"}`} />
        )}
        {/* Audio calls have no picture, but the remote voice still needs an element to play through. */}
        {!video && live && (
          <StreamVideo stream={p.remoteStream} className="absolute size-px opacity-0 pointer-events-none" />
        )}
        {video && live && bigHasVideo && <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/60 pointer-events-none" />}

        {p.phase !== "incoming" && p.phase !== "ended" && (
          <button type="button" aria-label={t("call.back")} onClick={p.onMinimize}
            className="absolute left-4 top-[max(1.25rem,calc(env(safe-area-inset-top)+0.5rem))] z-20 size-11 rounded-full grid place-items-center bg-white/15 border border-white/15 backdrop-blur-xl active:scale-90 transition">
            <AppIcon name="back" size={22} />
          </button>
        )}

        {/* top: who, and how it's going */}
        <div className="absolute inset-x-0 top-0 z-10 grid justify-items-center gap-1 px-6 pt-[max(1.25rem,calc(env(safe-area-inset-top)+0.5rem))] text-center pointer-events-none">
          <p className="font-display text-3xl leading-none drop-shadow inline-flex items-center gap-2">
            {p.other.name}
            {p.remoteMuted && p.phase === "connected" && <AppIcon name="micOff" size={16} label={t("call.mute")} />}
          </p>
          <p className="text-sm opacity-85 tabular-nums drop-shadow" role="status" aria-live="polite">{status}</p>
          {video && p.phase === "connected" && p.remoteCameraOff && <p className="text-xs opacity-70">{t("call.remoteCameraOff", { name: p.other.name })}</p>}
        </div>

        {showPreview && (
          <FloatingPreview
            stream={mainIsLocal ? p.remoteStream : p.localStream}
            muted={!mainIsLocal}
            mirror={!mainIsLocal && p.facingUser}
            off={mainIsLocal ? !remoteHasVideo : p.cameraOff}
            fallback={mainIsLocal ? <Avatar path={p.other.avatar} tone={p.other.tone} size={56} /> : <AppIcon name="videoOff" size={26} />}
            onSwap={() => setSwapped((s) => !s)}
            label={t("call.swapViews")}
          />
        )}

        {/* controls */}
        <div className={`absolute inset-x-0 bottom-0 z-10 grid justify-items-center gap-5 px-6 pb-[max(1.75rem,calc(env(safe-area-inset-bottom)+0.75rem))] transition duration-300 motion-reduce:transition-none ${controlsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}>
          {p.phase === "incoming" ? (
            <div className="flex items-center gap-20">
              <div className="grid justify-items-center gap-2"><RoundButton big label={t("call.decline")} danger onClick={p.onDecline}><AppIcon name="callEnd" size={28} /></RoundButton><span className="text-xs opacity-80">{t("call.decline")}</span></div>
              <div className="grid justify-items-center gap-2"><RoundButton big label={t("call.accept")} good onClick={p.onAccept}><AppIcon name={video ? "video" : "call"} size={28} /></RoundButton><span className="text-xs opacity-80">{t("call.accept")}</span></div>
            </div>
          ) : p.phase === "ended" ? (
            p.canRetry ? (
              <div className="flex items-center gap-20">
                <div className="grid justify-items-center gap-2"><RoundButton big label={t("common.cancel")} onClick={p.onCloseEnded}><AppIcon name="close" size={26} /></RoundButton><span className="text-xs opacity-80">{t("common.cancel")}</span></div>
                <div className="grid justify-items-center gap-2"><RoundButton big label={t("call.redial")} good onClick={p.onRedial}><AppIcon name={video ? "video" : "call"} size={28} /></RoundButton><span className="text-xs opacity-80">{t("call.redial")}</span></div>
              </div>
            ) : null
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-full bg-black/25 px-3 py-2.5 backdrop-blur-2xl border border-white/10">
                <RoundButton label={t("call.mute")} active={p.muted} onClick={p.onToggleMute}><AppIcon name={p.muted ? "micOff" : "mic"} size={22} /></RoundButton>
                {p.canSwitchOutput && <RoundButton label={t("call.speaker")} active={p.speakerOn} onClick={p.onCycleOutput}><AppIcon name="volume" size={22} /></RoundButton>}
                {video && (
                  <>
                    <RoundButton label={t("call.cameraToggle")} active={p.cameraOff} onClick={p.onToggleCamera}><AppIcon name={p.cameraOff ? "videoOff" : "video"} size={22} /></RoundButton>
                    <RoundButton label={t("call.switchCamera")} onClick={p.onFlipCamera}><AppIcon name="switchCamera" size={22} /></RoundButton>
                  </>
                )}
              </div>
              <RoundButton big label={t("call.end")} danger onClick={p.onHangup}><AppIcon name="callEnd" size={28} /></RoundButton>
            </>
          )}
        </div>
      </div>
    </Portal>
  );
}
