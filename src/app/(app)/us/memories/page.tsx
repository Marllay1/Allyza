import { MemoriesClient, type Photo } from "@/components/MemoriesClient";
import { PageHeader } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { requireCouple } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Reaction } from "@/lib/use-reactions";

export default async function MemoriesPage() {
  const v = await requireCouple();
  const { t } = await getT();
  const supabase = await createClient();
  const [{ data: photos }, { data: reactions }, { data: profiles }] = await Promise.all([
    supabase
      .from("couple_media")
      .select("id, author_id, category, storage_path, caption, taken_on, created_at")
      .neq("category", "journal")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.from("reactions").select("id, target_type, target_id, emoji, author_id").eq("target_type", "media").limit(1000),
    supabase.from("profiles").select("id, display_name"),
  ]);
  const otherId = v.id === v.couple.herId ? v.couple.partnerId : v.couple.herId;
  const other = profiles?.find((p) => p.id === otherId)?.display_name || t("couple.partnerFallback");
  return (
    <>
      <PageHeader title={t("couple.memories")} subtitle={t("memories.subtitle")} back="/us" backLabel={t("common.back")} />
      <MemoriesClient
        coupleId={v.couple.id}
        myId={v.id}
        initial={(photos ?? []) as Photo[]}
        initialReactions={(reactions ?? []) as Reaction[]}
        names={{ me: t("common.you"), other }}
      />
    </>
  );
}
