import Link from "next/link";
import { SoftToggle } from "@/components/RefugeExtras";
import { PageHeader, Section } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { requireHer } from "@/lib/session";

export default async function SoftPage() {
  const v = await requireHer();
  const { t } = await getT();
  return (
    <>
      <PageHeader title={t("soft.title")} subtitle={t("soft.tagline")} back="/refuge" backLabel={t("common.back")} />
      <Section>
        <p className="mb-4">{t("soft.explain")}</p>
        <ul className="grid gap-1.5 text-sm text-muted mb-5 list-disc pl-5">
          {t.arr("soft.includes").map((x) => <li key={x}>{x}</li>)}
        </ul>
        <SoftToggle on={v.prefs.soft_mode} />
        <p className="text-xs text-muted mt-3">{t("soft.notAssumption")}</p>
      </Section>
      {v.prefs.soft_mode && <Link href="/home" className="btn w-full">{t("soft.goHome")}</Link>}
    </>
  );
}
