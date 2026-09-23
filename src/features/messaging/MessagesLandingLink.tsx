"use client";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { AppIcon } from "@/components/icons";
import { useUnread } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n/provider";

/** Nothing but her, and a way in: no subtitle, no copy explaining what messaging is for. */
export function MessagesLandingLink({ name, avatar, tone }: { name: string; avatar: string | null; tone: "rose" | "gold" }) {
  const { t } = useI18n();
  const { unread } = useUnread();
  return (
    <Link href="/messages/chat" className="grid justify-items-center gap-4 rise" aria-label={`${name} — ${t("messaging.open")}`}>
      <Avatar path={avatar} tone={tone} size={88} />
      <span className="font-display text-3xl">{name}</span>
      <span className="relative grid place-items-center size-16 rounded-full bg-accent/15 text-accent transition duration-300 hover:bg-accent/25 active:scale-95">
        <AppIcon name="message" size={26} />
        {unread.message > 0 && <span className="absolute top-1 right-1 size-2.5 rounded-full bg-rose pop-in" role="status" aria-label={t("nav.new")} />}
      </span>
    </Link>
  );
}
