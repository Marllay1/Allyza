import { VaultClient, type VaultItem, type VaultState } from "@/components/VaultClient";
import { PageHeader } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { requireCouple } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function VaultPage() {
  const v = await requireCouple();
  const { t } = await getT();
  const supabase = await createClient();
  const { data: st } = await supabase.rpc("vault_status");
  const state: VaultState = { has_pin: !!st?.has_pin, unlocked: !!st?.unlocked, locked_until: st?.locked_until ?? null };

  // Rows only come back when the database says the vault is unlocked for this session.
  let items: VaultItem[] = [];
  let other = t("couple.partnerFallback");
  if (state.unlocked) {
    const { data } = await supabase.from("vault_items").select("id, author_id, kind, title, body, storage_path, created_at").order("created_at", { ascending: false }).limit(200);
    items = (data ?? []) as VaultItem[];
  }
  const otherId = v.id === v.couple.herId ? v.couple.partnerId : v.couple.herId;
  if (otherId) {
    const { data: p } = await supabase.from("profiles").select("display_name").eq("id", otherId).maybeSingle();
    if (p?.display_name) other = p.display_name;
  }
  return (
    <>
      <PageHeader title={t("couple.vault")} subtitle={t("vault.subtitle")} back="/us" backLabel={t("common.back")} />
      <VaultClient state={state} items={items} coupleId={v.couple.id} myId={v.id} names={{ me: t("common.you"), other }} />
    </>
  );
}
