# ALLYZA — *Her rhythm. Our little world.*

A bilingual (FR/EN) installable PWA with three distinct worlds:

| World | Purpose | Who sees it |
|---|---|---|
| 🌷 **Her space** | Cycle, pain, mood, fatigue, food, history, statistics | Only her, plus what she explicitly shares |
| 🌙 **The Refuge** | Soft Mode, messages, 7 mini-games, synthesized ambient sounds, poetry, breathing | Her (he can only leave messages) |
| 💕 **Us** | Live shared journal, private photos, little things, PIN-protected vault | Only the two of them |

Stack: Next.js 16 (App Router) · TypeScript · Tailwind 4 · Supabase (Auth, Postgres + RLS, Realtime, private Storage) · Vercel.

## Setup

1. Create a Supabase project. In **SQL editor** run `supabase/migrations/0001_init.sql`.
2. Authentication → URL configuration: set Site URL and add `<site>/auth/callback` to redirect URLs.
3. `cp .env.example .env.local` and fill it in (URL + anon key are required; the service-role key and VAPID keys enable push and full account-deletion cleanup).
4. `npm install && npm run dev`
5. Deploy to Vercel with the same environment variables.

Flow: she signs up as **Elle/Her** → Home shows an invite code → he signs up as **Partner** and enters it on his Home. Either side can end the link (the code rotates).

## Privacy model (enforced in Postgres, not just the UI)

- Health tables (`periods`, `daily_logs`, `food_logs`, `sharing_settings`) are readable/writable by their owner only. The partner has **no** SELECT on them.
- The partner reads through `partner_shared_status()`, a `SECURITY DEFINER` function that returns only what she enabled, as coarse bands (low/medium/high), with `null` for both “not shared” and “not logged”, so hidden data can't be inferred. Revocation is immediate.
- Couple content is scoped by `is_couple_member()`. Photos live in a **private** bucket and are shown through 1-hour signed URLs; EXIF/GPS is stripped in the browser before upload.
- The vault needs a shared PIN (bcrypt in DB, 15-min sessions, 5-strikes lockout) enforced by RLS and storage policies.
- Notifications carry only a *kind* and a language: never message content.
- The service worker caches only the offline shell and static assets. Private pages are `no-store`.
- Roles cannot be changed by clients (column-level grants); account deletion cascades.

Run `npm run test:db` to replay the migration in an in-process Postgres and assert these guarantees (34 checks).

## Product safeguards

Cycle average is always labelled *observed* (“Cycle moyen observé : 32 jours”), never a fixed rule. No ovulation/fertility predictions, no contraceptive claims, no diagnosis; food/sugar language is non-punitive; pain nudges are neutral.

## Adding a language

Copy `src/locales/en.ts`, translate, register it in `src/lib/i18n/server.ts` and `LOCALES`. TypeScript fails the build if any key is missing.

## Known limits / next steps

- The rate limiter is in-memory per instance (use Upstash/Redis at scale); the vault PIN lockout is in the database.
- Push needs VAPID keys and HTTPS; iOS requires the app to be installed to the home screen.
- Images use signed URLs directly (not `next/image`) by design.
