"use client";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { AppIcon } from "@/components/icons";
import { Portal } from "@/components/Portal";
import { useE2ee } from "@/features/e2ee/E2eeProvider";
import { usePhotos } from "@/features/messaging/media-store";
import { useI18n } from "@/lib/i18n/provider";
import { PhotoViewer } from "@/features/messaging/PhotoViewer";

/** Conversation info: who this is, the state of end-to-end encryption, and the shared photos so far —
 * a calm alternative to scrolling back through the whole history to find one. Opened from the header menu. */
export function ChatInfoSheet({ name, avatar, tone, onClose }: { name: string; avatar: string | null; tone: "rose" | "gold"; onClose: () => void }) {
  const { t } = useI18n();
  const photos = usePhotos();
  const e2ee = useE2ee();
  const [viewing, setViewing] = useState<number | null>(null);

  const statusKey = e2ee.phase === "needs-setup" ? "needsSetup" : e2ee.phase;
  const ready = e2ee.phase === "ready" || e2ee.phase === "waiting";

  return (
    <>
      <Portal>
        <div role="dialog" aria-modal="true" aria-label={t("messaging.info")} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-5" onClick={onClose}>
          <div className="card w-full sm:max-w-md max-h-[85dvh] overflow-y-auto rounded-b-none sm:rounded-3xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <span className="w-11" />
              <span className="grid justify-items-center gap-2">
                <Avatar path={avatar} tone={tone} size={64} />
                <span className="font-display text-2xl">{name}</span>
              </span>
              <button type="button" className="icon-btn !size-11" aria-label={t("common.close")} onClick={onClose}><AppIcon name="close" size={18} /></button>
            </div>

            <section className="rounded-2xl bg-surface2 p-4 mb-5 grid gap-3" aria-label={t("e2ee.sectionTitle")}>
              <div className="flex items-start gap-3">
                <span className={`grid place-items-center size-9 rounded-full shrink-0 ${e2ee.phase === "ready" ? "bg-accent/15 text-accent" : "bg-line/60 text-muted"}`}><AppIcon name="lock" size={17} /></span>
                <div className="min-w-0">
                  <p className="font-medium">{t("e2ee.sectionTitle")}</p>
                  <p className="text-sm text-muted mt-0.5">{t(`e2ee.status.${statusKey}`, { name })}</p>
                </div>
              </div>
              {e2ee.phase === "ready" && e2ee.safety && (
                <div className="grid gap-1.5">
                  <p className="eyebrow">{t("e2ee.safetyTitle")}</p>
                  <code className="block rounded-xl bg-surface px-3 py-2 text-sm tracking-wider tabular-nums text-center break-words select-all">{e2ee.safety}</code>
                  <p className="text-xs text-muted">{t("e2ee.safetyHint", { name })}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {(e2ee.phase === "off" || e2ee.phase === "needs-setup") && <button type="button" className="btn btn-primary !min-h-10 !px-4 text-sm" onClick={() => e2ee.openDialog("setup")}>{t("e2ee.enable")}</button>}
                {e2ee.phase === "locked" && <button type="button" className="btn btn-primary !min-h-10 !px-4 text-sm" onClick={() => e2ee.openDialog("restore")}>{t("e2ee.unlock")}</button>}
                {(ready || e2ee.phase === "locked") && (
                  <>
                    <button type="button" className="btn !min-h-10 !px-4 text-sm" onClick={() => e2ee.openDialog("reset")}>{t("e2ee.reset")}</button>
                    <button type="button" className="btn btn-ghost btn-danger !min-h-10 !px-4 text-sm" onClick={() => e2ee.openDialog("disable")}>{t("e2ee.disable")}</button>
                  </>
                )}
              </div>
            </section>

            <p className="eyebrow mb-2">{t("messaging.sharedPhotos", { n: photos.length })}</p>
            {photos.length === 0 ? (
              <p className="text-sm text-muted py-6 text-center">{t("messaging.noPhotosYet")}</p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {photos.map((url, i) => (
                  <button key={url} type="button" className="block aspect-square w-full overflow-hidden rounded-2xl bg-surface2" onClick={() => setViewing(i)} aria-label={t("messaging.aPhoto")}>
                    <img src={url} alt="" loading="lazy" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </Portal>
      {viewing !== null && <PhotoViewer urls={photos} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} />}
    </>
  );
}
