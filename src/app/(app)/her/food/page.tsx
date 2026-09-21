import { ClientOnly } from "@/components/ClientOnly";
import { FoodLogger } from "@/components/FoodLogger";
import { PageHeader, Section } from "@/components/ui";
import { loadHerData } from "@/lib/her-data";
import { getT } from "@/lib/i18n/server";
import { requireHer } from "@/lib/session";

export default async function FoodPage() {
  await requireHer();
  const { t } = await getT();
  const { food, logs } = await loadHerData();
  return (
    <>
      <PageHeader title={t("her.food")} subtitle={t("food.subtitle")} back="/her" backLabel={t("common.back")} />
      <Section>
        <ClientOnly>
          <FoodLogger food={food} logs={logs} />
        </ClientOnly>
      </Section>
    </>
  );
}
