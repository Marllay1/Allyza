"use client";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { AppIcon } from "@/components/icons";
import { useI18n } from "@/lib/i18n/provider";

/** The open conversation's own header — the app chrome is hidden, so this carries the back
 * button, her photo and her name, perfectly aligned on one row. */
export function ChatHeader({ name, avatar, tone, actions }: { name: string; avatar: string | null; tone: "rose" | "gold"; actions?: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="relative z-20 shrink-0 flex items-center gap-2 px-2 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)] pb-2.5">
      <Link href="/messages" aria-label={t("common.back")} className="icon-btn shrink-0 text-muted hover:text-ink">
        <AppIcon name="back" size={22} />
      </Link>
      <Avatar path={avatar} tone={tone} size={34} className="shrink-0" />
      <span className="font-display text-lg leading-none flex-1 min-w-0 truncate">{name}</span>
      {actions && <div className="flex items-center gap-1 shrink-0">{actions}</div>}
    </div>
  );
}
