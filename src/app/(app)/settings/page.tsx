import { LangSwitch } from "@/components/LangSwitch";
import { AvatarUpload } from "@/components/AvatarUpload";
import { NicknameForm } from "@/components/NicknameForm";
import { NameForm, ThemePicker } from "@/components/SettingsForms";
import { PageHeader, Section, TileLink } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { getPartner } from "@/lib/nickname";
import { requireViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const v = await requireViewer();
  const { t } = await getT();
  const isHer = v.role === "her";
  const supabase = await createClient();

  const otherId = v.couple ? (isHer ? v.couple.partnerId : v.couple.herId) : null;
  const [{ data: me }, partner, { data: myNick }] = await Promise.all([
    supabase.from("profiles").select("avatar_path").eq("id", v.id).maybeSingle(),
    getPartner(),
    otherId ? supabase.from("nicknames").select("nickname").eq("target_id", otherId).maybeSingle() : Promise.resolve({ data: null }),
  ]);

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
        <div className="grid gap-5">
          {v.couple && <AvatarUpload coupleId={v.couple.id} path={me?.avatar_path ?? null} tone={isHer ? "rose" : "gold"} />}
          <NameForm name={v.displayName} />
        </div>
      </Section>
      {v.couple?.partnerId && (
        <Section title={t("nicknameSettings.title")}>
          <NicknameForm initial={myNick?.nickname ?? ""} partnerDefaultName={partner?.displayName ?? t("couple.partnerFallback")} />
        </Section>
      )}
      <div className="grid gap-3">
        {isHer && <TileLink href="/settings/sharing" icon="lock" tone="rose" title={t("settings.sharing")} text={t("settings.sharingText")} />}
        <TileLink href="/settings/privacy" icon="privacy" tone="mauve" title={t("settings.privacy")} text={t("settings.privacyText")} />
        <TileLink href="/settings/sounds" icon="volume" tone="mauve" title={t("settings.sounds")} text={t("settings.soundsText")} />
        <TileLink href="/settings/notifications" icon="bell" tone="gold" title={t("settings.notifications")} text={t("settings.notificationsText")} />
        <TileLink href="/settings/account" icon="key" tone="accent" title={t("settings.security")} text={t("settings.securityText")} />
      </div>
    </>
  );
}
