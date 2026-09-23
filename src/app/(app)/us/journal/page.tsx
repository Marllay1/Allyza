import { NotebookClient, type Page, type PageMedia } from "@/features/couple/journal/NotebookClient";
import { PageHeader } from "@/components/ui";
import { getPartner } from "@/lib/nickname";
import { getT } from "@/lib/i18n/server";
import { requireCouple } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Reaction } from "@/lib/use-reactions";

export default async function JournalPage() {
  const v = await requireCouple();
  const { t } = await getT();
  const supabase = await createClient();

  const { data: latest } = await supabase
    .from("journal_entries")
    .select("id, author_id, title, body, mood, created_at, edited_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const pages = (latest ?? []) as Page[];
  const ids = pages.map((e) => e.id);

  const [{ data: media }, { data: reactions }, partner] = await Promise.all([
    ids.length
      ? supabase.from("couple_media").select("id, entry_id, storage_path").in("entry_id", ids)
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from("reactions").select("id, target_type, target_id, emoji, author_id").eq("target_type", "journal").in("target_id", ids)
      : Promise.resolve({ data: [] }),
    getPartner(),
  ]);

  const otherId = v.id === v.couple.herId ? v.couple.partnerId : v.couple.herId;
  const otherName = partner?.name ?? t("couple.partnerFallback");
  const people: Record<string, { name: string; avatar: string | null; tone: "rose" | "gold" }> = {
    [v.id]: { name: t("common.you"), avatar: null, tone: v.role === "her" ? "rose" : "gold" },
    ...(otherId ? { [otherId]: { name: otherName, avatar: partner?.avatarPath ?? null, tone: v.role === "her" ? "gold" : "rose" } } : {}),
  };

  return (
    <>
      <PageHeader title={t("couple.journal")} subtitle={t("notebook.subtitle")} back="/us" backLabel={t("common.back")} />
      <NotebookClient
        coupleId={v.couple.id}
        myId={v.id}
        initialPages={pages}
        initialMedia={(media ?? []) as PageMedia[]}
        initialReactions={(reactions ?? []) as Reaction[]}
        people={people}
      />
    </>
  );
}
