"use server";
import { z } from "zod";
import { fail, ok, rateLimit, uuid } from "@/lib/action-utils";
import { coupleCtx } from "@/lib/couple-ctx";
import { pingPartner } from "@/lib/push";
import { createHmac } from "node:crypto";

const STUN_FALLBACK: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

type RawIce = { urls?: string | string[]; username?: string; credential?: string };
const normalize = (list: RawIce[]): RTCIceServer[] =>
  list
    // Cloudflare advertises port 53 as well; Firefox stalls on it, and the other ports cover every network.
    .map((s) => ({ ...s, urls: ([] as string[]).concat(s.urls ?? []).filter((u) => !/:53(\?|$)/.test(u)) }))
    .filter((s) => s.urls.length > 0) as RTCIceServer[];

/**
 * ICE servers for one call. STUN alone connects same-network and many home-router calls; a TURN
 * relay is what makes Wi-Fi <-> 4G and 4G <-> 4G reliable. Two open, no-lock-in ways to get one,
 * both minting short-lived credentials on the server so no long-lived secret reaches the browser:
 *  1. Cloudflare Realtime TURN (free tier, no server to run):  CLOUDFLARE_TURN_KEY_ID + CLOUDFLARE_TURN_API_TOKEN
 *  2. Your own coturn (open source) with `use-auth-secret`:      TURN_URLS + TURN_SHARED_SECRET
 * With neither configured it falls back to public STUN.
 */
export async function getIceServersAction() {
  const c = await coupleCtx();
  if (!c) return fail("auth");

  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID;
  const token = process.env.CLOUDFLARE_TURN_API_TOKEN;
  if (keyId && token) {
    try {
      const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ttl: 3 * 3600 }),
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as { iceServers?: RawIce | RawIce[] };
        const servers = normalize(([] as RawIce[]).concat(data.iceServers ?? []));
        if (servers.length) return ok(servers);
      }
      console.error(`[calls] Cloudflare TURN credentials failed: HTTP ${res.status}`);
    } catch (e) {
      console.error("[calls] Cloudflare TURN unreachable:", e);
    }
  }

  const urls = process.env.TURN_URLS?.split(",").map((u) => u.trim()).filter(Boolean);
  const secret = process.env.TURN_SHARED_SECRET;
  if (urls?.length && secret) {
    const username = `${Math.floor(Date.now() / 1000) + 3 * 3600}:${c.uid}`;
    const credential = createHmac("sha1", secret).update(username).digest("base64");
    return ok([...STUN_FALLBACK, { urls, username, credential }]);
  }

  return ok(STUN_FALLBACK);
}

export async function startCallAction(input: { kind: "audio" | "video" }) {
  const p = z.object({ kind: z.enum(["audio", "video"]) }).safeParse(input);
  if (!p.success) return fail("invalid");
  const c = await coupleCtx();
  if (!c) return fail("auth");
  if (!c.couple.partner_id) return fail("forbidden");
  if (!rateLimit(`call:${c.uid}`, 20, 60_000)) return fail("rate");
  const calleeId = c.uid === c.couple.her_id ? c.couple.partner_id : c.couple.her_id;

  // A call that never got closed (app killed mid-ring, phone died) must not block every future call.
  const now = Date.now();
  await c.supabase.from("calls").update({ status: "missed", ended_at: new Date(now).toISOString() })
    .eq("couple_id", c.couple.id).eq("status", "ringing").lt("started_at", new Date(now - 90_000).toISOString());
  await c.supabase.from("calls").update({ status: "ended", ended_at: new Date(now).toISOString() })
    .eq("couple_id", c.couple.id).eq("status", "accepted").lt("answered_at", new Date(now - 4 * 3600_000).toISOString());

  const { data: active } = await c.supabase.from("calls").select("id").eq("couple_id", c.couple.id).in("status", ["ringing", "accepted"]).limit(1);
  if (active?.length) return fail("busy");

  const { data, error } = await c.supabase
    .from("calls")
    .insert({ couple_id: c.couple.id, caller_id: c.uid, callee_id: calleeId, kind: p.data.kind })
    .select("id, caller_id, callee_id, kind, status, started_at")
    .single();
  if (error || !data) return fail("generic");
  pingPartner("call", { callId: data.id });
  return ok(data);
}

const statusInput = z.object({
  id: uuid,
  status: z.enum(["accepted", "rejected", "cancelled", "missed", "ended", "failed"]),
});

export async function updateCallStatusAction(input: z.infer<typeof statusInput>) {
  const p = statusInput.safeParse(input);
  if (!p.success) return fail("invalid");
  const c = await coupleCtx();
  if (!c) return fail("auth");
  const { data: row } = await c.supabase.from("calls").select("caller_id, answered_at").eq("id", p.data.id).eq("couple_id", c.couple.id).maybeSingle();
  const patch: Record<string, string> = { status: p.data.status };
  if (p.data.status === "accepted") patch.answered_at = new Date().toISOString();
  if (p.data.status !== "accepted") patch.ended_at = new Date().toISOString();
  const { error } = await c.supabase.from("calls").update(patch).eq("id", p.data.id).eq("couple_id", c.couple.id);
  if (error) return fail("generic");
  // The caller gave up (or it rang out) before anyone answered: leave a "missed call" notice on the other phone.
  if (row && row.caller_id === c.uid && !row.answered_at && (p.data.status === "missed" || p.data.status === "cancelled")) pingPartner("missed_call", { callId: p.data.id });
  return ok();
}

/** Catches an incoming call that started just before this device subscribed to live updates. */
export async function myActiveCallAction() {
  const c = await coupleCtx();
  if (!c) return fail("auth");
  const { data } = await c.supabase
    .from("calls")
    .select("id, caller_id, callee_id, kind, status, started_at")
    .eq("couple_id", c.couple.id)
    .in("status", ["ringing", "accepted"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return ok(data ?? null);
}
