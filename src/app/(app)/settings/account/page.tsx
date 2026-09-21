import Link from "next/link";
import { AppIcon } from "@/components/icons";
import { PasswordForm, SignOutButton } from "@/components/SettingsForms";
import { PageHeader, Section } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { requireViewer } from "@/lib/session";

/** Security: password + logout (+ export of her own data). There is deliberately no way to delete the account here. */
export default async function AccountPage() {
  const v = await requireViewer();
  const { t } = await getT();
  return (
    <>
      <PageHeader title={t("settings.security")} back="/settings" backLabel={t("common.back")} />
      <Section title={t("account.signedInAs")}>
        <p className="font-display text-2xl">{v.displayName}</p>
        <p className="text-sm text-muted mt-1">{t("account.sessionNote")}</p>
        <div className="mt-4"><SignOutButton /></div>
      </Section>
      <Section title={t("account.security")}>
        <PasswordForm />
      </Section>
      {v.role === "her" && (
        <Section title={t("account.yourData")}>
          <p className="text-sm text-muted mb-3">{t("account.exportBody")}</p>
          <Link href="/api/export" prefetch={false} className="btn w-full" download>
            <AppIcon name="download" size={18} /> {t("account.export")}
          </Link>
        </Section>
      )}
    </>
  );
}
