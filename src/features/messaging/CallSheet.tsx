"use client";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { AppIcon } from "@/components/icons";
import { Portal } from "@/components/Portal";
import { useI18n } from "@/lib/i18n/provider";
import { haptic } from "@/lib/local-pref";

/**
 * The call screens, built and ready — mute, speaker, camera controls, an outgoing "ringing"
 * state — but with no signaling behind them yet. Per the brief: prepare the architecture
 * cleanly, never fake a live connection. Tapping a call button shows exactly that, honestly.
 */
export function CallButtons({ name, avatar, tone }: { name: string; avatar: string | null; tone: "rose" | "gold" }) {
  const { t } = useI18n();
  const [kind, setKind] = useState<"audio" | "video" | null>(null);
  return (
    <>
      <button type="button" className="icon-btn" aria-label={t("call.audioCall")} onClick={() => setKind("audio")}>
        <AppIcon name="call" size={18} />
      </button>
      <button type="button" className="icon-btn" aria-label={t("call.videoCall")} onClick={() => setKind("video")}>
        <AppIcon name="video" size={18} />
      </button>
      {kind && <CallScreen kind={kind} name={name} avatar={avatar} tone={tone} onClose={() => setKind(null)} />}
    </>
  );
}

function CallScreen({ kind, name, avatar, tone, onClose }: { kind: "audio" | "video"; name: string; avatar: string | null; tone: "rose" | "gold"; onClose: () => void }) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<"calling" | "notReady">("calling");
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setPhase("notReady"), 2400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <Portal>
    <div role="dialog" aria-modal="true" aria-label={t(kind === "video" ? "call.videoCall" : "call.audioCall")}
      className="fixed inset-0 z-50 flex flex-col items-center justify-between text-white pt-[max(3rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]"
      style={{ background: "radial-gradient(circle at 30% 20%, #3b1f52, #160e33 70%)" }}>
      <div className="grid justify-items-center gap-3 pt-6">
        <span className={phase === "calling" ? "pop-in" : ""}>
          <Avatar path={avatar} tone={tone} size={104} />
        </span>
        <p className="font-display text-3xl">{name}</p>
        <p className="text-sm opacity-75" role="status" aria-live="polite">
          {phase === "calling" ? t("call.calling") : t("call.notReady")}
        </p>
      </div>

      {phase === "notReady" && (
        <p className="max-w-xs text-center text-sm opacity-70 px-6">{t("call.notReadyBody")}</p>
      )}

      <div className="grid gap-6 justify-items-center pb-4">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => { setMuted((m) => !m); haptic(6); }} aria-pressed={muted}
            aria-label={t("call.mute")} className={`size-14 rounded-full grid place-items-center ${muted ? "bg-white text-[#3b1f52]" : "bg-white/15"}`}>
            <AppIcon name={muted ? "micOff" : "mic"} size={22} />
          </button>
          <button type="button" onClick={() => { setSpeaker((s) => !s); haptic(6); }} aria-pressed={speaker}
            aria-label={t("call.speaker")} className={`size-14 rounded-full grid place-items-center ${speaker ? "bg-white text-[#3b1f52]" : "bg-white/15"}`}>
            <AppIcon name="speaker" size={22} />
          </button>
          {kind === "video" && (
            <>
              <button type="button" onClick={() => { setCameraOff((c) => !c); haptic(6); }} aria-pressed={cameraOff}
                aria-label={t("call.cameraToggle")} className={`size-14 rounded-full grid place-items-center ${cameraOff ? "bg-white text-[#3b1f52]" : "bg-white/15"}`}>
                <AppIcon name={cameraOff ? "videoOff" : "video"} size={22} />
              </button>
              <button type="button" aria-label={t("call.switchCamera")} className="size-14 rounded-full grid place-items-center bg-white/15">
                <AppIcon name="switchCamera" size={22} />
              </button>
            </>
          )}
        </div>
        <button type="button" onClick={onClose} aria-label={t("call.end")} className="size-16 rounded-full grid place-items-center bg-danger text-white">
          <AppIcon name="callEnd" size={26} />
        </button>
      </div>
    </div>
    </Portal>
  );
}
