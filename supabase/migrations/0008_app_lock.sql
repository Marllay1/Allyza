-- ---------------------------------------------------------------------------
-- App lock: an optional PIN / password / biometric gate on top of the account
-- login, chosen and changed by each person for themselves. Only the server
-- (service role) ever reads or writes these tables: the secret is stored as a
-- salted scrypt hash and is never selectable from the browser.
-- ---------------------------------------------------------------------------
create table public.app_locks (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  method text not null check (method in ('pin', 'password', 'biometric')),
  -- scrypt$N$r$p$salt$hash. For 'biometric' this is the backup PIN.
  secret_hash text not null,
  idle_seconds integer not null default 60 check (idle_seconds between 0 and 86400),
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.app_locks enable row level security;
revoke all on public.app_locks from anon, authenticated;

-- Platform-authenticator (Face ID / Touch ID / Android biometrics) public keys.
-- The private key and the biometric data never leave the device's secure hardware.
create table public.app_lock_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  created_at timestamptz not null default now()
);
create index app_lock_credentials_user on public.app_lock_credentials (user_id);
alter table public.app_lock_credentials enable row level security;
revoke all on public.app_lock_credentials from anon, authenticated;
