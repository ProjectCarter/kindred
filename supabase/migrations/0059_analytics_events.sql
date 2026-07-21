-- Kindred — first-party analytics (append-only, privacy-conscious).
-- Run after 0058_claim_resume_staged_builds.sql.

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  anonymous_user_id text not null,
  session_id text not null,
  event_name text not null,
  event_timestamp timestamptz not null default now(),
  edition_date date,
  city text,
  state text,
  section_type text,
  content_id text,
  content_title text,
  destination_domain text,
  load_duration_ms integer,
  app_version text,
  platform text,
  error_code text,
  metadata jsonb not null default '{}'::jsonb
);

comment on table public.analytics_events is
  'Append-only first-party product analytics. No PII — city/state only, no GPS.';

create index if not exists analytics_events_event_name_idx
  on public.analytics_events (event_name);

create index if not exists analytics_events_event_timestamp_idx
  on public.analytics_events (event_timestamp desc);

create index if not exists analytics_events_edition_date_idx
  on public.analytics_events (edition_date);

create index if not exists analytics_events_city_idx
  on public.analytics_events (city);

create index if not exists analytics_events_anonymous_user_id_idx
  on public.analytics_events (anonymous_user_id);

create index if not exists analytics_events_user_created_idx
  on public.analytics_events (user_id, event_timestamp desc);

alter table public.analytics_events enable row level security;

-- Readers may append their own events only — no read/update/delete via client.
create policy "Users can insert their own analytics events"
  on public.analytics_events for insert
  with check (auth.uid() = user_id);
