import { InviteCard } from "@/components/LinkCards";
import { LangSwitch } from "@/components/LangSwitch";
import { NameForm, ThemePicker } from "@/components/SettingsForms";
import { PageHeader, Section, TileLink } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { requireViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const v = await requireViewer();
  const { t } = await getT();
  const isHer = v.role === "her";

  let otherName: string | undefined;
  const otherId = v.couple ? (isHer ? v.couple.partnerId : v.couple.herId) : null;
  if (otherId) {
    const supabase = await createClient();
    const { data } = await supabase.from("profiles").select("display_name").eq("id", otherId).maybeSingle();
    otherName = data?.display_name;
  }

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
      {v.couple && (isHer || v.couple.partnerId) && (
        <Section title={t("link.title")}>
          {isHer ? (
            <InviteCard code={v.couple.inviteCode} linked={!!v.couple.partnerId} partnerName={otherName} />
          ) : (
            <InviteCard code="" linked partnerName={otherName} />
          )}
        </Section>
      )}
      <div className="grid gap-3">
        {isHer && <TileLink href="/settings/sharing" icon="🔒" title={t("settings.sharing")} text={t("settings.sharingText")} />}
        <TileLink href="/settings/privacy" icon="🛡️" title={t("settings.privacy")} text={t("settings.privacyText")} />
        <TileLink href="/settings/notifications" icon="🔔" title={t("settings.notifications")} text={t("settings.notificationsText")} />
        <TileLink href="/settings/account" icon="👤" title={t("settings.account")} text={t("settings.accountText")} />
      </div>
    </>
  );
}
