"use client";
import { useEffect, useRef } from "react";
import { AppIcon, type IconName } from "@/components/icons";
import { Portal } from "@/components/Portal";
import { REACTION_EMOJIS } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/provider";
import { haptic } from "@/lib/local-pref";

export type Anchor = { top: number; bottom: number; left: number; right: number };
export type MenuAction = "reply" | "copy" | "edit" | "delete";

/** A message you press and hold: fires once after `ms`, never while the finger is scrolling. */
export function PressTarget({ onLongPress, disabled, className, style, children }: {
  onLongPress: (el: HTMLElement) => void; disabled?: boolean; className?: string; style?: React.CSSProperties; children: React.ReactNode;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  useEffect(() => clear, []);
  return (
    <div
      className={className}
      style={{ WebkitTouchCallout: "none", ...style }}
      onPointerDown={(e) => {
        if (disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
        origin.current = { x: e.clientX, y: e.clientY };
        const el = e.currentTarget;
        clear();
        timer.current = setTimeout(() => { timer.current = null; haptic(12); onLongPress(el); }, 420);
      }}
      onPointerMove={(e) => {
        const o = origin.current;
        if (o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > 10) clear();
      }}
      onPointerUp={clear}
      onPointerCancel={clear}
      onPointerLeave={clear}
      onContextMenu={(e) => { if (disabled) return; e.preventDefault(); clear(); onLongPress(e.currentTarget); }}
    >
      {children}
    </div>
  );
}

const REACT_H = 52, GAP = 8, ROW_H = 46, PAD = 6, EDGE = 8, TOP_SAFE = 64;
const REACT_W = REACTION_EMOJIS.length * 44 + 16, MENU_W = 208;

/**
 * Reactions above, actions below, both kept inside the visible screen whatever the message's
 * position or size: the bubble itself stays put (highlighted) and the panels slide to fit.
 */
export function MessageMenu({ anchor, mine, actions, myReactions, onReact, onAction, onClose }: {
  anchor: Anchor; mine: boolean; actions: MenuAction[]; myReactions: Set<string>;
  onReact: (emoji: string) => void; onAction: (a: MenuAction) => void; onClose: () => void;
}) {
  const { t } = useI18n();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const vw = window.innerWidth, vh = window.innerHeight;
  const menuH = actions.length * ROW_H + PAD * 2;
  const clampX = (w: number) => {
    const x = mine ? anchor.right - w : anchor.left;
    return Math.min(Math.max(EDGE, x), vw - w - EDGE);
  };
  let reactY = anchor.top - GAP - REACT_H;
  let menuY = anchor.bottom + GAP;
  reactY = Math.max(TOP_SAFE, reactY);
  menuY = Math.min(menuY, vh - EDGE - menuH);
  menuY = Math.max(menuY, reactY + REACT_H + GAP);
  if (menuY + menuH > vh - EDGE) { menuY = vh - EDGE - menuH; reactY = Math.max(EDGE, menuY - GAP - REACT_H); }

  const icon: Record<MenuAction, IconName> = { reply: "replyArrow", copy: "copy", edit: "edit", delete: "trash" };
  const label: Record<MenuAction, string> = { reply: t("messaging.reply"), copy: t("common.copy"), edit: t("common.edit"), delete: t("common.delete") };

  return (
    <Portal>
      <div role="dialog" aria-modal="true" aria-label={t("messaging.actions")} className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[2px]" onClick={onClose}>
        <div className="glass absolute flex items-center justify-between rounded-full px-2 pop-in" style={{ top: reactY, left: clampX(REACT_W), width: REACT_W, height: REACT_H }} onClick={(e) => e.stopPropagation()}>
          {REACTION_EMOJIS.map((e) => (
            <button key={e} type="button" aria-pressed={myReactions.has(e)} onClick={() => onReact(e)}
              className={`size-10 grid place-items-center rounded-full text-[1.35rem] transition active:scale-90 ${myReactions.has(e) ? "bg-accent/25" : "hover:bg-white/10"}`}>
              {e}
            </button>
          ))}
        </div>
        <div className="glass absolute grid rounded-3xl p-1.5 pop-in" style={{ top: menuY, left: clampX(MENU_W), width: MENU_W }} onClick={(e) => e.stopPropagation()}>
          {actions.map((a) => (
            <button key={a} type="button" onClick={() => onAction(a)}
              className={`flex items-center justify-between gap-3 rounded-2xl px-3.5 text-left transition hover:bg-white/10 active:bg-white/15 ${a === "delete" ? "text-danger" : ""}`}
              style={{ height: ROW_H }}>
              <span>{label[a]}</span>
              <AppIcon name={icon[a]} size={17} />
            </button>
          ))}
        </div>
      </div>
    </Portal>
  );
}
