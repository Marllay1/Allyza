import { JournalClient, type Entry, type JMedia } from "@/components/JournalClient";
import { PageHeader } from "@/components/ui";
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
    .select("id, author_id, body, created_at, edited_at")
    .order("created_at", { ascending: false })
    .limit(80);
  const entries = ((latest ?? []) as Entry[]).reverse();
  const ids = entries.map((e) => e.id);

  const [{ data: media }, { data: reactions }, { data: profiles }] = await Promise.all([
    ids.length
      ? supabase.from("couple_media").select("id, entry_id, storage_path, caption").in("entry_id", ids)
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from("reactions").select("id, target_type, target_id, emoji, author_id").eq("target_type", "journal").in("target_id", ids)
      : Promise.resolve({ data: [] }),
    supabase.from("profiles").select("id, display_name"),
  ]);
  const nameOf = (id: string) => profiles?.find((p) => p.id === id)?.display_name || "";
  const otherId = v.id === v.couple.herId ? v.couple.partnerId : v.couple.herId;

  return (
    <>
      <PageHeader title={t("couple.journal")} subtitle={t("journal.subtitle")} back="/us" backLabel={t("common.back")} />
      <JournalClient
        coupleId={v.couple.id}
        myId={v.id}
        herId={v.couple.herId}
        names={{ me: t("common.you"), other: (otherId && nameOf(otherId)) || t("couple.partnerFallback") }}
        initialEntries={entries}
        initialMedia={(media ?? []) as JMedia[]}
        initialReactions={(reactions ?? []) as Reaction[]}
      />
    </>
  );
}
