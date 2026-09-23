import "server-only";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/action-utils";
import { getAuthUser } from "@/lib/supabase/request";

export type PushKind = "journal" | "media" | "refuge" | "little" | "surprise" | "message" | "call";

/**
 * Sends the OTHER member of my couple a contentless "something new" ping.
 * Server-only (not a client-callable action). Payload = kind + language, never text.
 * Best-effort: the in-app notification row already exists, so failures are swallowed.
 */
export async function pingPartner(kind: PushKind) {
  try {
    const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    const admin = createAdminClient();
    if (!pub || !priv || !admin) return;

    const user = await getAuthUser();
    if (!user) return;
    if (!rateLimit(`push:${user.id}`, 30, 60_000)) return;

    const supabase = await createClient();
    const { data: couple } = await supabase.from("couples").select("her_id, partner_id").maybeSingle();
    if (!couple) return;
    const target = couple.her_id === user.id ? couple.partner_id : couple.her_id;
    if (!target) return;

    // An incoming call is time-sensitive and has no opt-out toggle; every other kind honours its preference.
    const prefKey = { journal: "notify_journal", media: "notify_media", refuge: "notify_refuge", little: "notify_little", surprise: "notify_surprise", message: "notify_message", call: null }[kind];
    const { data: prefs } = await admin.from("user_preferences").select("*").eq("user_id", target).maybeSingle();
    if (!prefs || (prefKey && prefs[prefKey] === false)) return;

    const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", target);
    if (!subs?.length) return;

    webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:hello@allyza.app", pub, priv);
    const payload = JSON.stringify({ kind, lang: prefs.locale });
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
        }
      }),
    );
  } catch {
    /* best effort */
  }
}
