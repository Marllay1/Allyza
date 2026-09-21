"use client";
import { useUnread, type Unread } from "@/components/AppShell";
import { useT } from "@/lib/i18n/provider";

/** A quiet dot, never a number and never any content: there is something new here. */
export function UnreadDot({ kinds }: { kinds: (keyof Unread)[] }) {
  const { unread } = useUnread();
  const t = useT();
  if (!kinds.some((k) => unread[k] > 0)) return null;
  return <span className="size-2.5 rounded-full bg-rose pop-in" role="status" aria-label={t("nav.new")} />;
}
