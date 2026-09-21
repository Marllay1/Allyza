"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toggleReactionAction } from "@/actions/us";

export type ReactionTarget = "journal" | "media" | "little" | "story" | "song" | "joke";
export type Reaction = { id: string; target_type: string; target_id: string; emoji: string; author_id: string };

/** Live reactions for a couple, with optimistic toggling. */
export function useReactions(coupleId: string, myId: string, initial: Reaction[]) {
  const [items, setItems] = useState<Reaction[]>(initial);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`reactions:${coupleId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reactions", filter: `couple_id=eq.${coupleId}` }, (p) => {
        const r = p.new as Reaction;
        setItems((cur) => {
          if (cur.some((x) => x.id === r.id)) return cur;
          // Swap my optimistic placeholder for the real row instead of duplicating it.
          const i = cur.findIndex((x) => x.id.startsWith("tmp-") && x.author_id === r.author_id && x.target_id === r.target_id && x.emoji === r.emoji);
          if (i < 0) return [...cur, r];
          const next = [...cur];
          next[i] = r;
          return next;
        });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "reactions" }, (p) => {
        const id = (p.old as { id?: string }).id;
        if (id) setItems((cur) => cur.filter((x) => x.id !== id));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [coupleId]);

  const toggle = useCallback(
    (targetType: ReactionTarget, targetId: string, emoji: string) => {
      setItems((cur) => {
        const mine = cur.find((r) => r.author_id === myId && r.target_id === targetId && r.emoji === emoji);
        return mine
          ? cur.filter((r) => r !== mine)
          : [...cur, { id: `tmp-${crypto.randomUUID()}`, target_type: targetType, target_id: targetId, emoji, author_id: myId }];
      });
      toggleReactionAction({ targetType, targetId, emoji });
    },
    [myId],
  );

  return { reactions: items, toggle };
}
