import "server-only";
import { after } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/action-utils";
import { getAuthUser } from "@/lib/supabase/request";

export type PushKind = "journal" | "media" | "refuge" | "little" | "surprise" | "message" | "call" | "missed_call";

const PREF_KEY: Record<PushKind, string | null> = {
  journal: "notify_journal", media: "notify_media", refuge: "notify_refuge", little: "notify_little",
  surprise: "notify_surprise", message: "notify_message",
  // Calls are time-sensitive and have no opt-out toggle.
  call: null, missed_call: null,
};

/**
 * Notifies the OTHER member of my couple. Server-only (not a client-callable action).
 * The payload is the kind, the language and the sender's name as the recipient knows them —
 * never message text or any content.
 *
 * The send runs inside `after()`: on serverless hosting a plain un-awaited promise is frozen the
 * moment the response goes out, which silently dropped every push before the phone ever saw it.
 * `after` keeps the function alive until the push service has answered.
 */
export function pingPartner(kind: PushKind, extra: { callId?: string } = {}) {
  after(async () => {
    try {
      const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      const priv = process.env.VAPID_PRIVATE_KEY;
      const admin = createAdminClient();
      if (!pub || !priv || !admin) { console.error("[push] skipped: VAPID keys or service role key missing on this deployment"); return; }

      const user = await getAuthUser();
      if (!user) return;
      if (!rateLimit(`push:${user.id}`, 60, 60_000)) return;

      const supabase = await createClient();
      const { data: couple } = await supabase.from("couples").select("her_id, partner_id").maybeSingle();
      if (!couple) return;
      const target = couple.her_id === user.id ? couple.partner_id : couple.her_id;
      if (!target) return;

      const prefKey = PREF_KEY[kind];
      const [{ data: prefs }, { data: subs }, { data: nick }, { data: sender }] = await Promise.all([
        admin.from("user_preferences").select("*").eq("user_id", target).maybeSingle(),
        admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", target),
        admin.from("nicknames").select("nickname").eq("owner_id", target).eq("target_id", user.id).maybeSingle(),
        admin.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
      ]);
      if (!prefs || (prefKey && prefs[prefKey] === false)) return;
      if (!subs?.length) { console.warn(`[push] no subscription for recipient (${kind})`); return; }

      webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:hello@allyza.app", pub, priv);
      const payload = JSON.stringify({ kind, lang: prefs.locale, name: nick?.nickname || sender?.display_name || "", callId: extra.callId });
      // A ringing call is worthless after ~a minute; everything else should still arrive when the phone comes back online.
      const options = { TTL: kind === "call" ? 60 : 86_400, urgency: kind === "call" || kind === "message" ? ("high" as const) : ("normal" as const) };

      await Promise.all(
        subs.map(async (s) => {
          try {
            await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, options);
          } catch (e) {
            const code = (e as { statusCode?: number }).statusCode;
            if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
            else console.error(`[push] ${kind} rejected by ${new URL(s.endpoint).host}: ${code ?? "network"} ${(e as { body?: string }).body ?? ""}`);
          }
        }),
      );
    } catch (e) {
      console.error("[push] failed:", e);
    }
  });
}
