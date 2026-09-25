"use client";
import { useEffect, useRef, useState } from "react";
import { AppIcon, type IconName } from "@/components/icons";
import { useCall } from "@/features/calls/CallProvider";
import { CallHistorySheet } from "@/features/messaging/CallHistory";
import { ChatInfoSheet } from "@/features/messaging/ChatInfo";
import { useI18n } from "@/lib/i18n/provider";

type Item = { icon: IconName; label: string; onSelect: () => void; disabled?: boolean };

/** A header button that unrolls a small list under it, and folds back on a tap elsewhere or Escape. */
function DropMenu({ trigger, label, items, className }: { trigger: React.ReactNode; label: string; items: Item[]; className: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button type="button" className={className} aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {trigger}
        <AppIcon name="down" size={14} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-2 z-40 w-56 card p-1.5 shadow-lg pop-in origin-top-right">
          {items.map((it) => (
            <button key={it.label} type="button" role="menuitem" disabled={it.disabled}
              className="w-full flex items-center gap-3 rounded-2xl px-3.5 h-11 text-left transition hover:bg-surface2 active:bg-surface2 disabled:opacity-50"
              onClick={() => { setOpen(false); it.onSelect(); }}>
              <AppIcon name={it.icon} size={18} className="text-accent" />
              <span>{it.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The conversation header's two menus: "Call" (audio / video) and the shared media + call history. */
export function ChatHeaderMenus({ myId, name, avatar, tone }: { myId: string; name: string; avatar: string | null; tone: "rose" | "gold" }) {
  const { t } = useI18n();
  const { startCall, inCall } = useCall();
  const [sheet, setSheet] = useState<"media" | "calls" | null>(null);

  return (
    <>
      <DropMenu
        label={t("call.menu")}
        className="btn !min-h-10 !px-3.5 gap-1.5 text-sm"
        trigger={<><AppIcon name="call" size={17} /><span>{t("call.menu")}</span></>}
        items={[
          { icon: "call", label: t("call.audioCall"), onSelect: () => startCall("audio"), disabled: inCall },
          { icon: "video", label: t("call.videoCall"), onSelect: () => startCall("video"), disabled: inCall },
        ]}
      />
      <DropMenu
        label={t("messaging.mediaMenu")}
        className="icon-btn !w-auto gap-1 px-2.5"
        trigger={<AppIcon name="info" size={18} />}
        items={[
          { icon: "addImage", label: t("messaging.sharedMediaTitle"), onSelect: () => setSheet("media") },
          { icon: "clock", label: t("call.history"), onSelect: () => setSheet("calls") },
        ]}
      />
      {sheet === "media" && <ChatInfoSheet name={name} avatar={avatar} tone={tone} onClose={() => setSheet(null)} />}
      {sheet === "calls" && <CallHistorySheet myId={myId} onClose={() => setSheet(null)} />}
    </>
  );
}
