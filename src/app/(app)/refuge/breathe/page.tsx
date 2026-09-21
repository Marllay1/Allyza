import { Breathe } from "@/components/RefugeExtras";
import { PageHeader } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { requireHer } from "@/lib/session";

export default async function BreathePage() {
  await requireHer();
  const { t } = await getT();
  return (
    <>
      <PageHeader title={t("refuge.breathe")} subtitle={t("breathe.subtitle")} back="/refuge" backLabel={t("common.back")} />
      <Breathe />
    </>
  );
}
