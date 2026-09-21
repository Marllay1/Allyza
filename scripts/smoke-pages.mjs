// Renders every signed-in page (FR + EN, her + partner) with real session cookies against a
// running dev/prod server and a REAL Supabase project. Throwaway users are deleted afterwards.
// Run: node --env-file=.env.local scripts/smoke-pages.mjs [baseUrl]
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const base = process.argv[2] ?? "http://localhost:3100";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const stamp = Date.now();
const pw = `Smoke-${stamp}-pw!`;
let failed = 0;
const check = (l, c, x = "") => { console.log(c ? "ok  " : "FAIL", l, c ? "" : x); if (!c) failed++; };

async function makeUser(role, name) {
  const email = `allyza.smoke.${role}.${stamp}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { role, display_name: name, locale: "fr" } });
  if (error) throw error;
  const jar = new Map();
  const ssr = createServerClient(url, anon, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach((c) => jar.set(c.name, c.value)) } });
  const { error: e2 } = await ssr.auth.signInWithPassword({ email, password: pw });
  if (e2) throw e2;
  return { id: data.user.id, ssr, jar };
}
const cookieHeader = (u, lang) => [...u.jar].map(([k, v]) => `${k}=${v}`).join("; ") + `; allyza_lang=${lang}`;
const get = (u, path, lang = "fr") => fetch(base + path, { headers: { cookie: cookieHeader(u, lang) }, redirect: "manual" });

const users = [];
try {
  const her = await makeUser("her", "Ada"); users.push(her);
  const him = await makeUser("partner", "Bo"); users.push(him);

  // Seed data so pages render real content.
  const d = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  await admin.from("periods").insert(["2026-03-13", "2026-04-18", "2026-05-21", "2026-06-21", "2026-07-21", "2026-08-22"].map((start_date) => ({ user_id: her.id, start_date })));
  for (let i = 0; i < 12; i++) await admin.from("daily_logs").insert({ user_id: her.id, log_date: d(i), pain: (i * 3) % 10, fatigue: (i * 5) % 10, mood: (i % 5) + 1, sugar_level: ["low", "moderate", "high"][i % 3], note: i === 0 ? "NOTE-PRIVEE-SECRETE" : null });
  await admin.from("food_logs").insert([{ user_id: her.id, log_date: d(0), category: "fruit" }, { user_id: her.id, log_date: d(0), category: "water" }]);
  const { data: couple } = await her.ssr.from("couples").select("id, invite_code").single();

  // Partner before linking
  let r = await get(him, "/home");
  check("partner (unlinked) /home renders join card", r.status === 200 && (await r.text()).includes("Rejoindre"));
  r = await get(him, "/us");
  check("partner (unlinked) /us redirects home", r.status === 307 || r.status === 308, String(r.status));

  const j = await him.ssr.rpc("join_couple", { p_code: couple.invite_code });
  check("partner joins", !j.error, j.error?.message);
  await her.ssr.from("journal_entries").insert({ couple_id: couple.id, body: "Bonjour mon cœur" });
  await him.ssr.from("refuge_messages").insert({ couple_id: couple.id, body: "Pense à boire de l'eau" });
  await her.ssr.from("little_things").insert({ couple_id: couple.id, kind: "question", body: "Ton souvenir préféré ?" });

  const herPages = ["/home", "/her", "/her/cycle", "/her/wellbeing", "/her/food", "/her/history", "/her/stats", "/refuge", "/refuge/soft", "/refuge/messages", "/refuge/games", "/refuge/games/petals", "/refuge/games/bubbles", "/refuge/games/memory", "/refuge/games/zen", "/refuge/games/clouds", "/refuge/games/stars", "/refuge/games/glow", "/refuge/atmosphere", "/refuge/poetry", "/refuge/breathe", "/refuge/little", "/us", "/us/journal", "/us/memories", "/us/little", "/us/vault", "/settings", "/settings/sharing", "/settings/privacy", "/settings/notifications", "/settings/account"];
  for (const lang of ["fr", "en"]) {
    for (const p of herPages) {
      const res = await get(her, p, lang);
      const html = res.status === 200 ? await res.text() : "";
      const bad = /Application error|Unhandled Runtime Error|This page couldn.t be found/i.test(html) || /\b(errors|common|nav|her|refuge)\.[a-zA-Z_.]+\b(?=<)/.test(html.replace(/<script[\s\S]*?<\/script>/g, ""));
      check(`her ${lang} ${p}`, res.status === 200 && !bad && html.includes(`lang="${lang}"`), `status ${res.status}${bad ? " (error/raw key in HTML)" : ""}`);
    }
  }
  const exp = await get(her, "/api/export");
  const expJson = exp.status === 200 ? await exp.json() : null;
  check("her export has her data", expJson?.periods?.length === 6 && expJson.dailyLogs.length === 12);

  // Content spot checks
  let html = await (await get(her, "/her/stats", "fr")).text();
  check("stats says 'Cycle moyen observé : 32 jours'", /Cycle moyen observé : 32 jours/.test(html.replace(/<!-- -->/g, "")));
  html = await (await get(her, "/her/stats", "en")).text();
  check("stats (EN) says 'Observed average cycle: 32 days'", /Observed average cycle: 32 days/.test(html.replace(/<!-- -->/g, "")));
  html = await (await get(her, "/us/journal", "fr")).text();
  check("journal shows entry", html.includes("Bonjour mon cœur"));

  // Partner side: linked
  const partnerPages = ["/home", "/refuge/messages", "/us", "/us/journal", "/us/memories", "/us/little", "/us/vault", "/settings", "/settings/privacy", "/settings/notifications", "/settings/account"];
  for (const lang of ["fr", "en"]) for (const p of partnerPages) {
    const res = await get(him, p, lang); const t = res.status === 200 ? await res.text() : "";
    check(`partner ${lang} ${p}`, res.status === 200 && !/Application error/.test(t), `status ${res.status}`);
  }
  html = await (await get(him, "/us/journal", "fr")).text();
  check("partner sees the journal entry", html.includes("Bonjour mon cœur"));
  for (const p of ["/her", "/her/cycle", "/her/stats", "/refuge/games", "/refuge/atmosphere", "/settings/sharing"]) {
    const res = await get(him, p);
    check(`partner is redirected away from ${p}`, res.status === 307 || res.status === 308, String(res.status));
  }
  r = await get(him, "/refuge");
  check("partner /refuge goes to messages only", (r.headers.get("location") ?? "").includes("/refuge/messages"));
  r = await get(him, "/api/export");
  const pj = r.status === 200 ? await r.json() : { periods: [] };
  check("partner export contains none of her data", !pj.periods?.length && !pj.dailyLogs?.length);

  // Nothing of hers may appear on any partner page
  let leaked = false;
  for (const p of partnerPages) { const t = await (await get(him, p)).text(); if (t.includes("NOTE-PRIVEE-SECRETE") || t.includes("2026-08-22")) leaked = true; }
  check("no private data leaks into partner HTML", !leaked);

  // Sharing changes what he sees (rendered client-side via RPC, so verify the RPC he calls)
  await her.ssr.from("sharing_settings").update({ share_mood: true, share_cycle_day: true }).eq("her_id", her.id);
  const st = (await him.ssr.rpc("partner_shared_status", { p_today: d(0) })).data;
  check("partner status reflects sharing", typeof st.cycle_day === "number" && st.mood !== null && st.pain === null);

  // Unauthenticated
  for (const p of ["/home", "/us/journal", "/her", "/api/export"]) {
    const res = await fetch(base + p, { redirect: "manual" });
    check(`signed-out ${p} -> login`, [307, 308].includes(res.status) && (res.headers.get("location") ?? "").includes("/login"), String(res.status));
  }
  const pub = await fetch(base + "/manifest.webmanifest"); check("manifest public", pub.status === 200);
} catch (e) {
  console.error("ABORTED:", e.message ?? e); failed++;
} finally {
  const ids = users.map((u) => u.id);
  const { data: cs } = await admin.from("couples").select("id").in("her_id", ids);
  for (const c of cs ?? []) for (const f of [c.id, `${c.id}/vault`]) {
    const { data: files } = await admin.storage.from("couple-media").list(f);
    const paths = (files ?? []).filter((x) => x.id).map((x) => `${f}/${x.name}`);
    if (paths.length) await admin.storage.from("couple-media").remove(paths);
  }
  for (const id of ids) await admin.auth.admin.deleteUser(id);
  console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL PAGE CHECKS PASSED");
  process.exit(failed ? 1 : 0);
}
