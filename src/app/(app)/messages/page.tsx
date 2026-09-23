import { MessagesLandingLink } from "@/features/messaging/MessagesLandingLink";
import { PageHeader } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { getPartner } from "@/lib/nickname";
import { requireCouple } from "@/lib/session";

export default async function MessagesLandingPage() {
  const v = await requireCouple();
  const { t } = await getT();
  const otherId = v.id === v.couple.herId ? v.couple.partnerId : v.couple.herId;
  if (!otherId) {
    return (
      <>
        <PageHeader title={t("messaging.title")} />
        <div className="card p-6 text-center text-muted">{t("couple.waitingShort")}</div>
      </>
    );
  }

  const partner = await getPartner();

  return (
    <div className="flex-1 grid place-items-center min-h-[65dvh]">
      <MessagesLandingLink name={partner?.name ?? t("couple.partnerFallback")} avatar={partner?.avatarPath ?? null} tone={partner?.tone ?? "gold"} />
    </div>
  );
}
