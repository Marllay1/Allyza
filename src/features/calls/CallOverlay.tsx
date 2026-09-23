"use client";
import { Avatar } from "@/components/Avatar";
import { AppIcon } from "@/components/icons";
import { Portal } from "@/components/Portal";
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
  canSwitchOutput: boolean;
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

function RoundButton({ label, active, onClick, children, danger, good }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode; danger?: boolean; good?: boolean }) {
  const tone = danger ? "bg-danger text-white" : good ? "bg-good text-white" : active ? "bg-white text-[#3b1f52]" : "bg-white/15 text-white";
  return (
    <button type="button" onClick={onClick} aria-label={label} aria-pressed={active}
      className={`size-14 rounded-full grid place-items-center transition active:scale-95 ${tone}`}>
      {children}
    </button>
  );
}

export function CallOverlay(p: OverlayProps) {
  const { t } = useI18n();
  const video = p.kind === "video";
  const live = p.phase === "connected" || p.phase === "connecting";
  const status =
    p.phase === "ended" ? p.notice
    : p.phase === "incoming" ? t(video ? "call.incomingVideo" : "call.incomingAudio", { name: p.other.name })
    : p.reconnecting ? t("call.reconnecting")
    : p.phase === "connected" ? clock(p.elapsed)
    : p.phase === "connecting" ? t("call.connecting")
    : p.ringing ? t("call.ringing") : t("call.calling");

  return (
    <Portal>
      <div role="dialog" aria-modal="true" aria-label={t(video ? "call.videoCall" : "call.audioCall")}
        className="fixed inset-0 z-[60] flex flex-col items-center justify-between text-white overflow-hidden pt-[max(3rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]"
        style={{ background: "radial-gradient(circle at 30% 20%, #3b1f52, #160e33 70%)" }}>
        {/* The other person's live video fills the screen; audio calls keep the calm portrait instead. */}
        <video ref={(el) => { if (el && el.srcObject !== p.remoteStream) el.srcObject = p.remoteStream; }} autoPlay playsInline
          className={video && live ? "absolute inset-0 size-full object-cover" : "hidden"} />
        {video && live && <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/55" />}

        <div className="relative grid justify-items-center gap-3 pt-6 text-center px-6">
          {!(video && p.phase === "connected") && (
            <span className={p.phase === "incoming" || p.phase === "outgoing" ? "pop-in" : ""}><Avatar path={p.other.avatar} tone={p.other.tone} size={104} /></span>
          )}
          <p className="font-display text-3xl">{p.other.name}</p>
          <p className="text-sm opacity-80 tabular-nums" role="status" aria-live="polite">{status}</p>
        </div>

        {video && p.localStream && p.phase !== "incoming" && p.phase !== "ended" && (
          <video ref={(el) => { if (el && el.srcObject !== p.localStream) el.srcObject = p.localStream; }} autoPlay playsInline muted
            className={`absolute right-4 top-[max(5.5rem,calc(env(safe-area-inset-top)+3.5rem))] w-28 aspect-[3/4] rounded-2xl object-cover border border-white/25 shadow-lg ${p.cameraOff ? "opacity-30" : ""}`} />
        )}

        <div className="relative grid gap-6 justify-items-center pb-4">
          {p.phase === "incoming" ? (
            <div className="flex items-center gap-16">
              <div className="grid justify-items-center gap-2"><RoundButton label={t("call.decline")} danger onClick={p.onDecline}><AppIcon name="callEnd" size={26} /></RoundButton><span className="text-xs opacity-80">{t("call.decline")}</span></div>
              <div className="grid justify-items-center gap-2"><RoundButton label={t("call.accept")} good onClick={p.onAccept}><AppIcon name={video ? "video" : "call"} size={26} /></RoundButton><span className="text-xs opacity-80">{t("call.accept")}</span></div>
            </div>
          ) : p.phase === "ended" ? null : (
            <>
              <div className="flex items-center gap-4">
                <RoundButton label={t("call.mute")} active={p.muted} onClick={p.onToggleMute}><AppIcon name={p.muted ? "micOff" : "mic"} size={22} /></RoundButton>
                {p.canSwitchOutput && <RoundButton label={t("call.speaker")} onClick={p.onCycleOutput}><AppIcon name="volume" size={22} /></RoundButton>}
                {video && (
                  <>
                    <RoundButton label={t("call.cameraToggle")} active={p.cameraOff} onClick={p.onToggleCamera}><AppIcon name={p.cameraOff ? "videoOff" : "video"} size={22} /></RoundButton>
                    <RoundButton label={t("call.switchCamera")} onClick={p.onFlipCamera}><AppIcon name="switchCamera" size={22} /></RoundButton>
                  </>
                )}
              </div>
              <RoundButton label={t("call.end")} danger onClick={p.onHangup}><AppIcon name="callEnd" size={26} /></RoundButton>
            </>
          )}
        </div>
      </div>
    </Portal>
  );
}
