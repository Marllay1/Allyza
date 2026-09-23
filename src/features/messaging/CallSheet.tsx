"use client";
import { AppIcon } from "@/components/icons";
import { useCall } from "@/features/calls/CallProvider";
import { useI18n } from "@/lib/i18n/provider";

/** The two call buttons in the conversation header. The call itself lives in CallProvider. */
export function CallButtons() {
  const { t } = useI18n();
  const { startCall, inCall } = useCall();
  return (
    <>
      <button type="button" className="icon-btn" disabled={inCall} aria-label={t("call.audioCall")} onClick={() => startCall("audio")}>
        <AppIcon name="call" size={18} />
      </button>
      <button type="button" className="icon-btn" disabled={inCall} aria-label={t("call.videoCall")} onClick={() => startCall("video")}>
        <AppIcon name="video" size={18} />
      </button>
    </>
  );
}
