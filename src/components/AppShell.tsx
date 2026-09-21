"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/provider";
import { AppIcon, AllyzaMark, type IconName } from "@/components/icons";
import { markNotificationsReadAction } from "@/actions/notifications";
import { RefugeAtmosphere } from "@/features/refuge/RefugeAtmosphere";
import { GoodNightCurtain } from "@/features/home/GoodNight";
import { endNight, useNightMode } from "@/lib/local-pref";

export type Unread = { journal: number; media: number; refuge: number; little: number; surprise: number };
type Kind = keyof Unread;

const UnreadCtx = createContext<{ unread: Unread; markRead: (kinds: Kind[]) => void }>({
  unread: { journal: 0, media: 0, refuge: 0, little: 0, surprise: 0 },
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
  const night = useNightMode();
  const [unread, setUnread] = useState(initialUnread);
  const [collapsed, setCollapsed] = useState(false);
  const scroll = useRef({ y: 0, timer: 0 as unknown as ReturnType<typeof setTimeout>, holdUntil: 0 });

  // Live badges. Rows carry only a "kind": never any content.
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`notif:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (p) => {
        const k = (p.new as { kind: Kind }).kind;
        setUnread((u) => ({ ...u, [k]: (u[k] ?? 0) + 1 }));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  const markRead = useCallback((kinds: Kind[]) => {
    setUnread((u) => { const next = { ...u }; kinds.forEach((k) => (next[k] = 0)); return next; });
    markNotificationsReadAction(kinds);
  }, []);

  // The navbar contracts while the page moves and comes back when it rests. One passive listener,
  // state only changes on transitions, so scrolling never re-renders on every frame.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const s = scroll.current;
    s.y = window.scrollY;
    const onScroll = () => {
      if (!mq.matches) return;
      const y = window.scrollY;
      const moved = Math.abs(y - s.y) > 4;
      s.y = y;
      if (!moved || Date.now() < s.holdUntil) return;
      setCollapsed((c) => (c ? c : true));
      clearTimeout(s.timer);
      s.timer = setTimeout(() => setCollapsed(false), 260);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); clearTimeout(s.timer); };
  }, []);
  const expand = () => { scroll.current.holdUntil = Date.now() + 1500; clearTimeout(scroll.current.timer); setCollapsed(false); };

  const value = useMemo(() => ({ unread, markRead }), [unread, markRead]);
  const space = path.startsWith("/refuge") ? "refuge" : path.startsWith("/us") ? "us" : "her";

  const items: { href: string; icon: IconName; label: string; match: string; badge: number }[] = [
    { href: "/home", icon: "home", label: t("nav.home"), match: "/home", badge: 0 },
    ...(role === "her" ? [{ href: "/her", icon: "her" as IconName, label: t("nav.her"), match: "/her", badge: 0 }] : []),
    { href: "/refuge", icon: "refuge", label: t("nav.refuge"), match: "/refuge", badge: unread.refuge },
    { href: "/us", icon: "us", label: t("nav.us"), match: "/us", badge: unread.journal + unread.media + unread.little + unread.surprise },
    { href: "/settings", icon: "settings", label: t("nav.settings"), match: "/settings", badge: 0 },
  ];

  return (
    <UnreadCtx.Provider value={value}>
      <div data-space={space} data-soft={softMode ? "on" : "off"} data-night={night ? "on" : "off"} className="room relative min-h-dvh flex flex-col">
        {space === "refuge" && <RefugeAtmosphere />}
        <header className="relative z-20 flex items-center justify-between px-4 pt-[max(0.7rem,env(safe-area-inset-top))] pb-1">
          <Link href="/home" className="flex items-center gap-2.5" aria-label="Allyza">
            <AllyzaMark height={34} />
            <span className="font-display text-2xl tracking-wide lowercase">allyza</span>
          </Link>
          <div className="flex items-center gap-1">
            {night && (
              <button className="icon-btn text-gold" aria-label={t("night.morning")} title={t("night.morning")} onClick={endNight}>
                <AppIcon name="sun" size={20} />
              </button>
            )}
            <span className="eyebrow pl-1">{t(`space.${space}`)}</span>
          </div>
        </header>

        <main id="main" key={path} className="page-enter relative z-10 flex-1 w-full max-w-2xl mx-auto px-4 pt-3 pb-36">{children}</main>

        <div className="nav-shell">
          <nav aria-label={t("nav.main")} className="nav-pill glass" data-collapsed={collapsed}>
            <ul className="nav-items">
              {items.map((i) => {
                const active = path === i.match || path.startsWith(i.match + "/");
                return (
                  <li key={i.href} className="contents">
                    <Link href={i.href} className="nav-item" aria-current={active ? "page" : undefined} tabIndex={collapsed ? -1 : 0}>
                      <AppIcon name={i.icon} size={22} />
                      <span>{i.label}</span>
                      {i.badge > 0 && <span className="nav-dot" role="status" aria-label={t("nav.new")} />}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <button className="nav-compact" onClick={expand} aria-label={t("nav.expand")} tabIndex={collapsed ? 0 : -1}>
              <AllyzaMark height={26} />
              <span className="font-display text-xl lowercase">allyza</span>
            </button>
          </nav>
        </div>
        <GoodNightCurtain />
      </div>
    </UnreadCtx.Provider>
  );
}
