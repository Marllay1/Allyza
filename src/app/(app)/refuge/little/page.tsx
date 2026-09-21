import { ClientOnly } from "@/components/ClientOnly";
import { TinyComforts } from "@/components/RefugeExtras";
import { PageHeader } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { requireHer } from "@/lib/session";

export default async function RefugeLittlePage() {
  await requireHer();
  const { t } = await getT();
  return (
    <>
      <PageHeader title={t("refuge.little")} subtitle={t("refuge.tinySubtitle")} back="/refuge" backLabel={t("common.back")} />
      <ClientOnly>
        <TinyComforts items={t.arr("refuge.tiny")} />
      </ClientOnly>
      <p className="text-xs text-muted text-center mt-6">{t("refuge.tinyNote")}</p>
    </>
  );
}
