import { AppShell, type Unread } from "@/components/AppShell";
import { AppLockGuard } from "@/features/applock/AppLockGuard";
import { LockScreen } from "@/features/applock/LockScreen";
import { CallProvider } from "@/features/calls/CallProvider";
import { getLockRow, isLockedOut, isUnlocked } from "@/lib/app-lock";
import { getPartner } from "@/lib/nickname";
import { requireViewer } from "@/lib/session";
import { getSupabase } from "@/lib/supabase/request";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // The unread query only needs the session cookie (RLS scopes it), so it runs alongside the viewer lookup.
  const supabase = await getSupabase();
  const viewer = await requireViewer();

  // Protection on + not unlocked: render ONLY the lock screen. Nothing else is fetched or sent to the browser.
  const lock = await getLockRow(viewer.id);
  const unlocked = !lock || (await isUnlocked(viewer.id));
  if (lock && !unlocked) {
    return <LockScreen method={lock.method} locked={isLockedOut(lock)} />;
  }

  const [{ data }, partner] = await Promise.all([
    supabase.from("notifications").select("kind").is("read_at", null).limit(200),
    getPartner(),
  ]);
  const unread: Unread = { journal: 0, media: 0, refuge: 0, little: 0, surprise: 0, message: 0 };
  for (const n of data ?? []) unread[n.kind as keyof Unread]++;

  const app = (
    <CallProvider
      coupleId={viewer.couple?.id ?? ""}
      myId={viewer.id}
      other={viewer.couple && partner ? { id: partner.id, name: partner.name, avatar: partner.avatarPath, tone: partner.tone } : null}
    >
      <AppShell userId={viewer.id} role={viewer.role} softMode={viewer.role === "her" && viewer.prefs.soft_mode} initialUnread={unread}>
        {children}
      </AppShell>
    </CallProvider>
  );
  return lock ? <AppLockGuard idleSeconds={lock.idle_seconds}>{app}</AppLockGuard> : app;
}
