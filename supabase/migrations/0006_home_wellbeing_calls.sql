-- ---------------------------------------------------------------------------
-- Custom content: pieces Llayane writes for Alhanouzzia to discover (notes,
-- compliments, poems, letters, memories, jokes, encouragements, "open
-- when…", surprises, daily messages). Drafts and scheduled items are only
-- ever visible to their author; she only ever sees published, due content.
-- ---------------------------------------------------------------------------
create table public.custom_content (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  category text not null check (category in
    ('note', 'compliment', 'poem', 'letter', 'memory', 'joke', 'encouragement', 'open_when', 'surprise', 'daily')),
  title text check (char_length(title) <= 120),
  body text not null check (char_length(body) between 1 and 4000),
  storage_path text,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published')),
  publish_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (storage_path is null or storage_path like couple_id::text || '/%')
);
create index custom_content_couple_status on public.custom_content (couple_id, status, created_at desc);
alter table public.custom_content enable row level security;

create policy custom_content_select on public.custom_content for select to authenticated
  using (
    public.is_couple_member(couple_id)
    and (
      author_id = (select auth.uid())
      or (status = 'published' and (publish_at is null or publish_at <= now()))
      or (status = 'scheduled' and publish_at <= now())
    )
  );
create policy custom_content_insert on public.custom_content for insert to authenticated
  with check (public.is_couple_member(couple_id) and author_id = (select auth.uid()));
create policy custom_content_update on public.custom_content for update to authenticated
  using (author_id = (select auth.uid()) and public.is_couple_member(couple_id))
  with check (author_id = (select auth.uid()));
create policy custom_content_delete on public.custom_content for delete to authenticated
  using (author_id = (select auth.uid()) and public.is_couple_member(couple_id));

create function public.custom_content_touch() returns trigger
language plpgsql security definer set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;
create trigger custom_content_touch_trg before update on public.custom_content
  for each row execute function public.custom_content_touch();

-- ---------------------------------------------------------------------------
-- Well-being: energy (distinct from fatigue) and a lightweight sleep log.
-- Duration is computed client-side from bedtime/wake, not stored redundantly.
-- ---------------------------------------------------------------------------
alter table public.daily_logs add column energy smallint check (energy between 0 and 10);
alter table public.daily_logs add column sleep_bedtime time;
alter table public.daily_logs add column sleep_wake_time time;
alter table public.daily_logs add column sleep_quality smallint check (sleep_quality between 1 and 5);

-- ---------------------------------------------------------------------------
-- Calls: real metadata for real WebRTC sessions between the two accounts.
-- No audio/video is ever stored — only who called whom, when, and how it went.
-- ---------------------------------------------------------------------------
create table public.calls (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  caller_id uuid not null references public.profiles (id) on delete cascade,
  callee_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('audio', 'video')),
  status text not null default 'ringing' check (status in
    ('ringing', 'accepted', 'rejected', 'cancelled', 'missed', 'ended', 'failed')),
  started_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz
);
create index calls_couple_started on public.calls (couple_id, started_at desc);
alter table public.calls enable row level security;

create policy calls_select on public.calls for select to authenticated
  using (public.is_couple_member(couple_id));
create policy calls_insert on public.calls for insert to authenticated
  with check (public.is_couple_member(couple_id) and caller_id = (select auth.uid()) and callee_id <> caller_id);
-- Either party updates call state (answer, reject, hang up) — never who called whom or when it started.
create policy calls_update on public.calls for update to authenticated
  using (public.is_couple_member(couple_id))
  with check (public.is_couple_member(couple_id));

create function public.calls_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.couple_id := old.couple_id;
  new.caller_id := old.caller_id;
  new.callee_id := old.callee_id;
  new.kind := old.kind;
  new.started_at := old.started_at;
  return new;
end $$;
create trigger calls_guard_trg before update on public.calls
  for each row execute function public.calls_guard();

alter publication supabase_realtime add table public.calls;
