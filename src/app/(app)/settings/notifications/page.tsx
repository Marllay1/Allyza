import { PrefSwitches, PushToggle } from "@/components/SettingsForms";
import { PageHeader } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { requireViewer } from "@/lib/session";

export default async function NotificationsPage() {
  const v = await requireViewer();
  const { t } = await getT();
  return (
    <>
      <PageHeader title={t("settings.notifications")} subtitle={t("notifications.subtitle")} back="/settings" backLabel={t("common.back")} />
      <div className="grid gap-4">
        <PushToggle vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />
        <PrefSwitches prefs={v.prefs} showRefuge />
        <p className="text-xs text-muted text-center text-balance">{t("notifications.privacyNote")}</p>
      </div>
    </>
  );
}
