import { AppShell, type Unread } from "@/components/AppShell";
import { requireViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("kind").is("read_at", null).limit(200);
  const unread: Unread = { journal: 0, media: 0, refuge: 0, little: 0 };
  for (const n of data ?? []) unread[n.kind as keyof Unread]++;

  return (
    <AppShell userId={viewer.id} role={viewer.role} softMode={viewer.role === "her" && viewer.prefs.soft_mode} initialUnread={unread}>
      {children}
    </AppShell>
  );
}
