"use client";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { AppIcon } from "@/components/icons";
import { Portal } from "@/components/Portal";
import { useI18n } from "@/lib/i18n/provider";
import { PhotoViewer } from "@/features/messaging/PhotoViewer";

/** Conversation info: who this is, and the shared photos so far — a calm alternative to
 * scrolling back through the whole history to find one. Opened from the header menu. */
export function ChatInfoSheet({ name, avatar, tone, photos, onClose }: { name: string; avatar: string | null; tone: "rose" | "gold"; photos: string[]; onClose: () => void }) {
  const { t } = useI18n();
  const [viewing, setViewing] = useState<number | null>(null);
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
            <p className="eyebrow mb-2">{t("messaging.sharedPhotos", { n: photos.length })}</p>
            {photos.length === 0 ? (
              <p className="text-sm text-muted py-6 text-center">{t("messaging.noPhotosYet")}</p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {photos.map((url, i) => (
                  <button key={i} type="button" className="block aspect-square w-full overflow-hidden rounded-2xl bg-surface2" onClick={() => setViewing(i)} aria-label={t("messaging.aPhoto")}>
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
