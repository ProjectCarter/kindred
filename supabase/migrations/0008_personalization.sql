-- Kindred — Personalization engine (Milestone 4)
-- Quiet learning signals + profile affinity columns.
-- Run after 0007_lead_story.sql.

-- Derived preferences (also recomputed from signals at edition build).
alter table public.profiles
  add column if not exists followed_topics text[] not null default '{}';

alter table public.profiles
  add column if not exists favorite_sources text[] not null default '{}';

alter table public.profiles
  add column if not exists skipped_topics text[] not null default '{}';

alter table public.profiles
  add column if not exists location jsonb;

comment on column public.profiles.followed_topics is
  'Quietly learned or confirmed topics for ranking boosts.';
comment on column public.profiles.favorite_sources is
  'Publishers the reader engages with most.';
comment on column public.profiles.skipped_topics is
  'Topics the reader consistently skips or abandons.';
comment on column public.profiles.location is
  'Last known {city,region,state,lat,lon} for overnight editions.';

-- Enrich clippings so rebuilds still leave a personalization trail.
alter table public.clippings
  add column if not exists section_type text;

alter table public.clippings
  add column if not exists story_key text;

alter table public.clippings
  add column if not exists source text;

alter table public.clippings
  add column if not exists headline text;

-- Behavioral signals — section-agnostic for every future Kindred section.
create table if not exists public.user_reading_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  signal_type text not null
    check (signal_type in (
      'open',
      'read_progress',
      'read_complete',
      'clip',
      'unclip',
      'skip',
      'source_engage'
    )),
  story_key text not null,
  section_type text,
  edition_id uuid references public.editions(id) on delete set null,
  section_id uuid references public.edition_sections(id) on delete set null,
  source text,
  topic text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists user_reading_signals_user_created_idx
  on public.user_reading_signals (user_id, created_at desc);

create index if not exists user_reading_signals_user_type_idx
  on public.user_reading_signals (user_id, signal_type, created_at desc);

create index if not exists user_reading_signals_story_key_idx
  on public.user_reading_signals (user_id, story_key);

alter table public.user_reading_signals enable row level security;

create policy "Users can view their own reading signals"
  on public.user_reading_signals for select
  using (auth.uid() = user_id);

create policy "Users can insert their own reading signals"
  on public.user_reading_signals for insert
  with check (auth.uid() = user_id);

-- Service role used by Edge Functions bypasses RLS for aggregation.
