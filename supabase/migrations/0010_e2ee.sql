-- End-to-end encryption for the conversation (and authentication of call signalling).
--
-- The server stores ciphertext it cannot read. Each person has an ECDH P-256 key pair made ON THEIR DEVICE:
--   * the public key is stored here, readable by the other member of the couple;
--   * the private key is stored here only WRAPPED (AES-GCM under a key derived from a passphrase the person
--     chooses, PBKDF2), so a new device can restore it. The passphrase and the raw private key never leave the device.
-- Messages keep their metadata (who, when, kind, duration) but their content (text, sticker id, the wrapped
-- per-file key of a photo / voice note) is ciphertext when messages.enc = 1. Files in Storage are ciphertext too.
-- Encryption is opt-in per couple: once BOTH members have a key, plaintext messages are refused (no silent downgrade).

create table public.e2ee_keys (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  couple_id uuid not null references public.couples (id) on delete cascade,
  public_key text not null check (char_length(public_key) between 60 and 200),
  wrapped_private text not null check (char_length(wrapped_private) between 40 and 4000),
  kdf_salt text not null check (char_length(kdf_salt) between 16 and 100),
  kdf_iterations integer not null check (kdf_iterations between 100000 and 5000000),
  created_at timestamptz not null default now()
);
alter table public.e2ee_keys enable row level security;

-- Own row only: the wrapped private key is never exposed to the partner.
create policy e2ee_keys_own on public.e2ee_keys for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.is_couple_member(couple_id));

-- The partner's PUBLIC key (and nothing else) is readable through this function.
create function public.partner_public_key() returns table (user_id uuid, public_key text)
language sql stable security definer set search_path = ''
as $$
  select k.user_id, k.public_key
  from public.e2ee_keys k
  where k.user_id <> (select auth.uid())
    and public.is_couple_member(k.couple_id)
$$;
revoke all on function public.partner_public_key() from public, anon;
grant execute on function public.partner_public_key() to authenticated;

-- Messages: an `enc` marker, and room for ciphertext (base64 is ~4/3 the size of the text it hides).
alter table public.messages add column enc smallint not null default 0 check (enc in (0, 1));
alter table public.messages drop constraint messages_body_check;
alter table public.messages add constraint messages_body_check check (char_length(body) <= 12000);

-- The marker is fixed at creation like everything else about a message.
create or replace function public.messages_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.couple_id := old.couple_id;
  new.author_id := old.author_id;
  new.kind := old.kind;
  new.enc := old.enc;
  new.storage_path := old.storage_path;
  new.duration_ms := old.duration_ms;
  new.reply_to := old.reply_to;
  new.created_at := old.created_at;
  if new.body is distinct from old.body and new.deleted_at is null then new.edited_at := now(); end if;
  if new.deleted_at is not null then new.body := null; end if;
  return new;
end $$;

-- No downgrade: when both members have keys, a plaintext message is refused by the database itself.
create function public.messages_require_enc() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.enc = 0 and (select count(*) from public.e2ee_keys where couple_id = new.couple_id) >= 2 then
    raise exception 'e2ee_required' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger messages_require_enc_trg before insert on public.messages
  for each row execute function public.messages_require_enc();

-- Encrypted files are opaque bytes.
update storage.buckets
set allowed_mime_types = (select array_agg(distinct m) from unnest(allowed_mime_types || array['application/octet-stream']) as m)
where id = 'couple-media';
