"use client";
import { useEffect } from "react";
import { AppIcon } from "@/components/icons";
import { Portal } from "@/components/Portal";
import { useI18n } from "@/lib/i18n/provider";

/** Full-screen photo viewer with previous/next and a Save button (share sheet on phones, download elsewhere). */
export function PhotoViewer({ urls, index, onIndex, onClose }: { urls: string[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const { t } = useI18n();
  const url = urls[index];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < urls.length - 1) onIndex(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, urls.length, onIndex, onClose]);

  const save = async () => {
    try {
      const blob = await (await fetch(url)).blob();
      const ext = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg";
      const file = new File([blob], `allyza-${Date.now()}.${ext}`, { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return; }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") window.open(url, "_blank");
    }
  };

  if (!url) return null;
  return (
    <Portal>
      <div role="dialog" aria-modal="true" aria-label={t("messaging.aPhoto")} className="fixed inset-0 z-[60] bg-black/90 flex flex-col text-white">
        <div className="flex items-center justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <span className="text-sm opacity-80">{urls.length > 1 ? `${index + 1} / ${urls.length}` : ""}</span>
          <div className="flex gap-2">
            <button type="button" className="size-11 rounded-full bg-white/10 grid place-items-center" aria-label={t("messaging.savePhoto")} onClick={save}><AppIcon name="download" size={20} /></button>
            <button type="button" className="size-11 rounded-full bg-white/10 grid place-items-center" aria-label={t("common.close")} onClick={onClose}><AppIcon name="close" size={20} /></button>
          </div>
        </div>
        <div className="flex-1 min-h-0 flex items-center justify-center relative px-2 pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={onClose}>
          {index > 0 && <button type="button" className="absolute left-1 z-10 size-11 rounded-full bg-white/10 grid place-items-center" aria-label={t("common.previous")} onClick={(e) => { e.stopPropagation(); onIndex(index - 1); }}><AppIcon name="back" size={22} /></button>}
          <img src={url} alt={t("messaging.aPhoto")} className="max-h-full max-w-full object-contain rounded-xl" onClick={(e) => e.stopPropagation()} />
          {index < urls.length - 1 && <button type="button" className="absolute right-1 z-10 size-11 rounded-full bg-white/10 grid place-items-center" aria-label={t("common.next")} onClick={(e) => { e.stopPropagation(); onIndex(index + 1); }}><AppIcon name="forward" size={22} /></button>}
        </div>
      </div>
    </Portal>
  );
}
