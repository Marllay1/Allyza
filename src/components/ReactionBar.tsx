"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n/provider";
import { REACTION_EMOJIS } from "@/lib/constants";
import type { Reaction } from "@/lib/use-reactions";

export function ReactionBar({
  targetType,
  targetId,
  reactions,
  myId,
  toggle,
}: {
  targetType: "journal" | "media" | "little";
  targetId: string;
  reactions: Reaction[];
  myId: string;
  toggle: (type: "journal" | "media" | "little", id: string, emoji: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const mine = reactions.filter((r) => r.target_id === targetId);
  const grouped = REACTION_EMOJIS.map((e) => ({
    e,
    n: mine.filter((r) => r.emoji === e).length,
    me: mine.some((r) => r.emoji === e && r.author_id === myId),
  })).filter((g) => g.n > 0);

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
      {grouped.map((g) => (
        <button key={g.e} type="button" aria-pressed={g.me} className="chip !min-h-8 !px-2.5 !text-sm" onClick={() => toggle(targetType, targetId, g.e)}>
          {g.e} {g.n}
        </button>
      ))}
      <button type="button" className="chip !min-h-8 !px-2.5 !text-sm" aria-expanded={open} aria-label={t("couple.react")} onClick={() => setOpen((o) => !o)}>
        {open ? "✕" : "＋"}
      </button>
      {open &&
        REACTION_EMOJIS.map((e) => (
          <button key={e} type="button" className="chip !min-h-8 !px-2 !text-base" onClick={() => { toggle(targetType, targetId, e); setOpen(false); }}>
            {e}
          </button>
        ))}
    </div>
  );
}
