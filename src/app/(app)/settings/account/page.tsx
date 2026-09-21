import Link from "next/link";
import { DeleteAccount, PasswordForm, SignOutButton } from "@/components/SettingsForms";
import { PageHeader, Section } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { requireViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function AccountPage() {
  const v = await requireViewer();
  const { t } = await getT();
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return (
    <>
      <PageHeader title={t("settings.account")} back="/settings" backLabel={t("common.back")} />
      <Section title={t("account.signedInAs")}>
        <p className="break-all">{data.user?.email}</p>
        <div className="mt-4"><SignOutButton /></div>
      </Section>
      <Section title={t("account.security")}>
        <PasswordForm />
      </Section>
      {v.role === "her" && (
        <Section title={t("account.yourData")}>
          <p className="text-sm text-muted mb-3">{t("account.exportBody")}</p>
          <Link href="/api/export" prefetch={false} className="btn w-full" download>⬇ {t("account.export")}</Link>
        </Section>
      )}
      <Section title={t("account.dangerZone")}>
        <DeleteAccount isHer={v.role === "her"} />
      </Section>
    </>
  );
}
