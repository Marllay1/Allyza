import { PageHeader } from "@/components/ui";
import { Constellation, type Counts, type Star } from "@/features/couple/constellation/Constellation";
import { getT } from "@/lib/i18n/server";
import { requireCouple } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function UniversePage() {
  await requireCouple();
  const { t } = await getT();
  const supabase = await createClient();
  const [{ data: stars }, { data: counts }] = await Promise.all([
    supabase.from("story_moments").select("id, title, moment_date, body, storage_path").order("moment_date", { ascending: true }).limit(300),
    supabase.rpc("couple_counts"),
  ]);
  return (
    <>
      <PageHeader title={t("couple.universe")} subtitle={t("universe.subtitle")} back="/us" backLabel={t("common.back")} />
      <Constellation
        stars={(stars ?? []) as Star[]}
        counts={{ memories: 0, photos: 0, letters: 0, songs: 0, jokes: 0, ...(counts as Partial<Counts> | null) }}
      />
    </>
  );
}
