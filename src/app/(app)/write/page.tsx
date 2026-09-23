import { PageHeader } from "@/components/ui";
import { WriteClient, type ContentItem } from "@/features/home/WriteClient";
import { getT } from "@/lib/i18n/server";
import { requirePartner } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function WritePage() {
  const v = await requirePartner();
  const { t } = await getT();
  const supabase = await createClient();

  const { data: mine } = await supabase
    .from("custom_content")
    .select("id, category, title, body, storage_path, status, publish_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <>
      <PageHeader title={t("write.title")} subtitle={t("write.subtitle")} back="/home" backLabel={t("common.back")} />
      <WriteClient coupleId={v.couple.id} items={(mine ?? []) as ContentItem[]} />
    </>
  );
}
