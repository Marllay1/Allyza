import { AmbientPlayer } from "@/components/AmbientPlayer";
import { PageHeader } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { requireHer } from "@/lib/session";

export default async function AtmospherePage() {
  await requireHer();
  const { t } = await getT();
  return (
    <>
      <PageHeader title={t("refuge.needCalm")} subtitle={t("atmosphere.subtitle")} back="/refuge" backLabel={t("common.back")} />
      <AmbientPlayer />
    </>
  );
}
