import { LangSwitch } from "@/components/LangSwitch";
import { NameForm, ThemePicker } from "@/components/SettingsForms";
import { PageHeader, Section, TileLink } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { requireViewer } from "@/lib/session";

export default async function SettingsPage() {
  const v = await requireViewer();
  const { t } = await getT();
  const isHer = v.role === "her";

  return (
    <>
      <PageHeader title={t("nav.settings")} />
      <Section title={t("settings.language")}>
        <LangSwitch />
        <p className="text-xs text-muted mt-3">{t("settings.languageHint")}</p>
      </Section>
      <Section title={t("settings.appearance")}>
        <ThemePicker value={v.prefs.theme} />
      </Section>
      <Section title={t("settings.profile")}>
        <NameForm name={v.displayName} />
      </Section>
      <div className="grid gap-3">
        {isHer && <TileLink href="/settings/sharing" icon="lock" tone="rose" title={t("settings.sharing")} text={t("settings.sharingText")} />}
        <TileLink href="/settings/privacy" icon="privacy" tone="mauve" title={t("settings.privacy")} text={t("settings.privacyText")} />
        <TileLink href="/settings/notifications" icon="bell" tone="gold" title={t("settings.notifications")} text={t("settings.notificationsText")} />
        <TileLink href="/settings/account" icon="key" tone="accent" title={t("settings.security")} text={t("settings.securityText")} />
      </div>
    </>
  );
}
