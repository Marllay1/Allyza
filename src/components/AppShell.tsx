"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/provider";
import { Mark } from "@/components/Logo";
import { markNotificationsReadAction } from "@/actions/notifications";

export type Unread = { journal: number; media: number; refuge: number; little: number };
type Kind = keyof Unread;

const UnreadCtx = createContext<{ unread: Unread; markRead: (kinds: Kind[]) => void }>({
  unread: { journal: 0, media: 0, refuge: 0, little: 0 },
  markRead: () => {},
});
export const useUnread = () => useContext(UnreadCtx);

type Props = {
  userId: string;
  role: "her" | "partner";
  softMode: boolean;
  initialUnread: Unread;
  children: React.ReactNode;
};

export function AppShell({ userId, role, softMode, initialUnread, children }: Props) {
  const t = useT();
  const path = usePathname();
  const [unread, setUnread] = useState(initialUnread);

  // Live badge updates. Rows carry only a "kind": never any content.
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`notif:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (p) => {
          const k = (p.new as { kind: Kind }).kind;
          setUnread((u) => ({ ...u, [k]: u[k] + 1 }));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId]);

  const markRead = useCallback((kinds: Kind[]) => {
    setUnread((u) => {
      const next = { ...u };
      kinds.forEach((k) => (next[k] = 0));
      return next;
    });
    markNotificationsReadAction(kinds);
  }, []);

  const value = useMemo(() => ({ unread, markRead }), [unread, markRead]);

  const space = path.startsWith("/refuge") ? "refuge" : path.startsWith("/us") ? "us" : "her";

  const items = [
    { href: "/home", icon: "◐", label: t("nav.home"), match: "/home", badge: 0 },
    ...(role === "her" ? [{ href: "/her", icon: "🌷", label: t("nav.her"), match: "/her", badge: 0 }] : []),
    { href: "/refuge", icon: "🌙", label: t("nav.refuge"), match: "/refuge", badge: unread.refuge },
    { href: "/us", icon: "💕", label: t("nav.us"), match: "/us", badge: unread.journal + unread.media + unread.little },
    { href: "/settings", icon: "⚙️", label: t("nav.settings"), match: "/settings", badge: 0 },
  ];

  return (
    <UnreadCtx.Provider value={value}>
      <div data-space={space} data-soft={softMode ? "on" : "off"} className="min-h-dvh flex flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between px-4 pt-[max(0.6rem,env(safe-area-inset-top))] pb-2 backdrop-blur-md bg-bg/60">
          <Link href="/home" className="flex items-center gap-2" aria-label="Allyza">
            <Mark size={34} />
            <span className="font-display uppercase tracking-[0.3em] text-lg">Allyza</span>
          </Link>
          <span className="eyebrow">{t(`space.${space}`)}</span>
        </header>
        <main id="main" className="flex-1 w-full max-w-2xl mx-auto px-4 pt-3 pb-32">{children}</main>
        <nav
          aria-label={t("nav.main")}
          className="fixed bottom-0 inset-x-0 z-40 border-t border-line bg-surface/85 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
        >
          <ul className="max-w-2xl mx-auto grid" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
            {items.map((i) => {
              const active = path === i.match || path.startsWith(i.match + "/");
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex flex-col items-center gap-0.5 py-2.5 min-h-16 text-[0.7rem] transition ${
                      active ? "text-ink" : "text-muted"
                    }`}
                  >
                    <span className={`text-xl leading-none ${active ? "" : "grayscale opacity-70"}`} aria-hidden>{i.icon}</span>
                    {i.label}
                    {i.badge > 0 && (
                      <span aria-label={t("nav.new")} className="absolute top-2 left-1/2 ml-2 size-2.5 rounded-full bg-rose" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </UnreadCtx.Provider>
  );
}
