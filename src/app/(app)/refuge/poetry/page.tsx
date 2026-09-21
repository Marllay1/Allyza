import { PoetryReader } from "@/components/RefugeExtras";
import { PageHeader } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { requireHer } from "@/lib/session";

export default async function PoetryPage() {
  await requireHer();
  const { t } = await getT();
  return (
    <>
      <PageHeader title={t("refuge.poetry")} subtitle={t("refuge.poetryText")} back="/refuge" backLabel={t("common.back")} />
      <PoetryReader poems={t.arr("poetry.poems")} />
    </>
  );
}
