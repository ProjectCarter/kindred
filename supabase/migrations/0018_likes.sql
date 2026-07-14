-- Kindred — Private Like system (Milestone: Library & Personalization refinement)
-- A quiet, per-user "show me more like this" signal. No counts, no profiles,
-- no feed — likes only ever drive this reader's own future editions.
-- Run after 0017_unified_clippings.sql.

create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- Same four content types Clippings supports — Pin and Like both live on
  -- the same four native pages (Articles, Events, Activities, Recommendations).
  content_type text not null
    check (content_type in ('article', 'event', 'activity', 'recommendation')),
  -- Same key shape as clippings.clip_key (`${contentType}:${id}`) so a like
  -- and a pin on the same item are trivially comparable, but tracked
  -- independently — liking never requires pinning, and vice versa.
  like_key text not null,
  -- Content System type / discovery category (e.g. "hiking", "museum",
  -- "coffee") captured at like time — the only thing the recommendation
  -- engine actually reads back, via user_reading_signals below.
  category text,
  headline text,
  created_at timestamptz not null default now(),
  unique (user_id, like_key)
);

create index if not exists likes_user_id_created_at_idx
  on public.likes (user_id, created_at desc);

alter table public.likes enable row level security;

create policy "Users can view their own likes"
  on public.likes for select
  using (auth.uid() = user_id);

create policy "Users can add their own likes"
  on public.likes for insert
  with check (auth.uid() = user_id);

create policy "Users can remove their own likes"
  on public.likes for delete
  using (auth.uid() = user_id);

-- Let the private Like heart write "like" / "unlike" reading signals
-- through the existing personalization pipeline (aggregateReadingSignals
-- in supabase/functions/_shared/personalization/aggregate.ts already knows
-- how to fold a new signal_type into followedTopics — this migration only
-- has to let the row insert succeed).
alter table public.user_reading_signals
  drop constraint if exists user_reading_signals_signal_type_check;

alter table public.user_reading_signals
  add constraint user_reading_signals_signal_type_check
    check (signal_type in (
      'open',
      'read_progress',
      'read_complete',
      'clip',
      'unclip',
      'like',
      'unlike',
      'skip',
      'source_engage'
    ));
