/**
 * Allyza sign-in is by username. Supabase Auth needs an e-mail-shaped identifier, so each username maps
 * deterministically to an INTERNAL address that never receives mail (accounts are provisioned by
 * scripts/seed-users.mjs; there is no signup, invitation or e-mail reset flow).
 * Keep in sync with the same function in scripts/seed-users.mjs.
 */
export const INTERNAL_EMAIL_DOMAIN = "users.allyza.app";

export const normalizeUsername = (u: string) => u.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");

export const usernameToEmail = (u: string) => `${normalizeUsername(u)}@${INTERNAL_EMAIL_DOMAIN}`;
