import { SoundSettings } from "@/components/SoundSettings";
import { PageHeader } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function SoundsPage() {
  const { t } = await getT();
  return (
    <>
      <PageHeader title={t("settings.sounds")} subtitle={t("sounds.subtitle")} back="/settings" backLabel={t("common.back")} />
      <SoundSettings />
    </>
  );
}
