// Provisions the two Allyza accounts and links them into one private couple space.
//
//   node --env-file=.env.local scripts/seed-users.mjs [--reset-passwords]
//
// Passwords are NEVER in the source or in Git: they come from the environment
//   ALLYZA_INITIAL_USER_1_PASSWORD / ALLYZA_INITIAL_USER_2_PASSWORD
// and are hashed by Supabase Auth (bcrypt) — plaintext is never stored. Usernames/display names default
// to the two initial accounts and can be overridden with ALLYZA_INITIAL_USER_{1,2}_USERNAME.
// Safe to re-run: existing accounts are kept (passwords only change with --reset-passwords).
import { createClient } from "@supabase/supabase-js";

// Keep in sync with src/lib/username.ts
const DOMAIN = "users.allyza.app";
const normalize = (u) => u.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
const emailOf = (u) => `${normalize(u)}@${DOMAIN}`;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const reset = process.argv.includes("--reset-passwords");

const accounts = [
  { n: 1, role: "her", name: process.env.ALLYZA_INITIAL_USER_1_USERNAME || "Alhanouzzia" },
  { n: 2, role: "partner", name: process.env.ALLYZA_INITIAL_USER_2_USERNAME || "Llayane" },
].map((a) => ({ ...a, password: process.env[`ALLYZA_INITIAL_USER_${a.n}_PASSWORD`] }));

for (const a of accounts) {
  if (!a.password || a.password.length < 8) { console.error(`ALLYZA_INITIAL_USER_${a.n}_PASSWORD is missing or shorter than 8 characters`); process.exit(1); }
}

async function findByEmail(email) {
  for (let page = 1; page < 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

const ids = {};
for (const a of accounts) {
  const email = emailOf(a.name);
  let user = await findByEmail(email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email, password: a.password, email_confirm: true,
      user_metadata: { role: a.role, display_name: a.name, username: normalize(a.name), locale: "fr" },
    });
    if (error) { console.error(`create ${a.name}:`, error.message); process.exit(1); }
    user = data.user;
    console.log(`created  ${a.name} (${a.role})`);
  } else if (reset) {
    const { error } = await admin.auth.admin.updateUserById(user.id, { password: a.password });
    if (error) { console.error(`reset ${a.name}:`, error.message); process.exit(1); }
    console.log(`password reset for ${a.name}`);
  } else {
    console.log(`exists   ${a.name}`);
  }
  ids[a.n] = user.id;
}

// One private couple space: her (account 1) + partner (account 2).
const { data: couple, error: ce } = await admin.from("couples").select("id, partner_id").eq("her_id", ids[1]).single();
if (ce) { console.error("couple lookup:", ce.message); process.exit(1); }
if (couple.partner_id !== ids[2]) {
  const { error } = await admin.from("couples").update({ partner_id: ids[2] }).eq("id", couple.id);
  if (error) { console.error("link:", error.message); process.exit(1); }
  console.log("linked the two accounts into one couple space");
} else console.log("already linked");
console.log("done");
