import { MessagesLandingLink } from "@/features/messaging/MessagesLandingLink";
import { PageHeader } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { getMyNicknameForPartner } from "@/lib/nickname";
import { requireCouple } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function MessagesLandingPage() {
  const v = await requireCouple();
  const { t } = await getT();
  const supabase = await createClient();

  const otherId = v.id === v.couple.herId ? v.couple.partnerId : v.couple.herId;
  if (!otherId) {
    return (
      <>
        <PageHeader title={t("messaging.title")} />
        <div className="card p-6 text-center text-muted">{t("couple.waitingShort")}</div>
      </>
    );
  }

  const { data: otherProfile } = await supabase.from("profiles").select("display_name, avatar_path").eq("id", otherId).maybeSingle();
  const otherName = await getMyNicknameForPartner(otherId, otherProfile?.display_name || t("couple.partnerFallback"));
  const otherTone = v.role === "her" ? "gold" : "rose";

  return (
    <div className="flex-1 grid place-items-center min-h-[65dvh]">
      <MessagesLandingLink name={otherName} avatar={otherProfile?.avatar_path ?? null} tone={otherTone} />
    </div>
  );
}
