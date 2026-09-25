"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n/provider";
import { AppIcon } from "@/components/icons";
import { Sticker } from "@/components/Sticker";
import { stickerFromReaction } from "@/lib/stickers";
import { REACTION_EMOJIS } from "@/lib/constants";
import type { Reaction, ReactionTarget } from "@/lib/use-reactions";

export function ReactionBar({
  targetType,
  targetId,
  reactions,
  myId,
  toggle,
  showAdd = true,
  onMore,
}: {
  targetType: ReactionTarget;
  targetId: string;
  reactions: Reaction[];
  myId: string;
  toggle: (type: ReactionTarget, id: string, emoji: string) => void;
  /** The "+" picker. Off in Messages, where reactions come from long-pressing the message instead. */
  showAdd?: boolean;
  /** Adds a "+" chip after the reactions that opens a full emoji choice. */
  onMore?: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const mine = reactions.filter((r) => r.target_id === targetId);
  // Quick reactions first, then any other emoji people used.
  const used = [...new Set(mine.map((r) => r.emoji))];
  const ordered = [...REACTION_EMOJIS.filter((e) => used.includes(e)), ...used.filter((e) => !(REACTION_EMOJIS as readonly string[]).includes(e))];
  const grouped = ordered.map((e) => ({
    e,
    n: mine.filter((r) => r.emoji === e).length,
    me: mine.some((r) => r.emoji === e && r.author_id === myId),
  })).filter((g) => g.n > 0);

  if (!showAdd && grouped.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
      {grouped.map((g) => (
        <button key={g.e} type="button" aria-pressed={g.me} className="chip !min-h-8 !px-2.5 !text-sm" onClick={() => toggle(targetType, targetId, g.e)}>
          {stickerFromReaction(g.e) ? <Sticker id={stickerFromReaction(g.e)!} size={22} /> : g.e} {g.n}
        </button>
      ))}
      {onMore && !showAdd && <button type="button" className="chip !min-h-8 !px-2.5 !text-sm" aria-label={t("couple.react")} onClick={onMore}><AppIcon name="plus" size={15} /></button>}
      {showAdd && <button type="button" className="chip !min-h-8 !px-2.5 !text-sm" aria-expanded={open} aria-label={t("couple.react")} onClick={() => setOpen((o) => !o)}>
        <AppIcon name={open ? "close" : "plus"} size={15} />
      </button>}
      {showAdd && open &&
        REACTION_EMOJIS.map((e) => (
          <button key={e} type="button" className="chip !min-h-8 !px-2 !text-base" onClick={() => { toggle(targetType, targetId, e); setOpen(false); }}>
            {e}
          </button>
        ))}
    </div>
  );
}
