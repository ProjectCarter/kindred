-- Kindred — Events shared catalog (per-event, scheduled sync)
-- Server-side source of truth for Local Events.
-- Provider APIs are queried only by scheduled sync — never per user/session.

create table if not exists public.events_catalog_metros (
  metro_key text primary key,
  city text not null,
  region text,
  state text,
  lat double precision not null,
  lon double precision not null,
  initial_import_completed_at timestamptz,
  last_full_sync_at timestamptz,
  last_incremental_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.events_catalog_metros is
  'Metros enrolled in the shared Events catalog. Full sync daily; incremental every 4 hours.';

create table if not exists public.events_catalog (
  id uuid primary key default gen_random_uuid(),
  metro_key text not null,
  provider text not null,
  provider_id text not null,
  dedupe_key text not null,
  name text not null,
  editorial_title text,
  venue text,
  city text,
  address text,
  lat double precision,
  lon double precision,
  start_at timestamptz,
  end_at timestamptz,
  event_timezone text,
  official_website text,
  ticket_url text,
  content_fingerprint text not null,
  lifecycle text not null default 'discovered'
    check (lifecycle in (
      'discovered', 'verified', 'upcoming', 'today', 'past', 'archived',
      'rejected', 'duplicate'
    )),
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected', 'needs_review')),
  verification_confidence integer not null default 0,
  event_payload jsonb not null,
  editorial_teaser text,
  editorial_body jsonb,
  source_history jsonb not null default '[]'::jsonb,
  image_source text,
  image_license text,
  duplicate_of uuid references public.events_catalog (id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_verified_at timestamptz not null default now(),
  last_material_change_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (metro_key, provider, provider_id)
);

comment on table public.events_catalog is
  'Shared Local Events catalog — verified listings within the 30-day horizon. Past events archived, not deleted.';

create index if not exists events_catalog_metro_lifecycle_idx
  on public.events_catalog (metro_key, lifecycle)
  where lifecycle in ('verified', 'upcoming', 'today');
create index if not exists events_catalog_metro_start_idx
  on public.events_catalog (metro_key, start_at);
create index if not exists events_catalog_dedupe_key_idx
  on public.events_catalog (metro_key, dedupe_key);

create table if not exists public.events_catalog_provider_links (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events_catalog (id) on delete cascade,
  metro_key text not null,
  provider text not null,
  provider_id text not null,
  last_seen_at timestamptz not null default now(),
  unique (metro_key, provider, provider_id)
);

create table if not exists public.events_catalog_sync_runs (
  id uuid primary key default gen_random_uuid(),
  metro_key text not null,
  mode text not null check (mode in ('incremental', 'full')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  api_calls integer not null default 0,
  raw_records_returned integer not null default 0,
  existing_skipped integer not null default 0,
  new_discovered integer not null default 0,
  changed_updated integer not null default 0,
  duplicates_merged integer not null default 0,
  records_rejected integer not null default 0,
  articles_queued integer not null default 0,
  estimated_cost_usd numeric(10, 6),
  run_duration_ms integer,
  next_scheduled_at timestamptz,
  diagnostics jsonb not null default '{}'::jsonb
);

create index if not exists events_catalog_sync_runs_metro_idx
  on public.events_catalog_sync_runs (metro_key, started_at desc);

alter table public.events_catalog_metros enable row level security;
alter table public.events_catalog enable row level security;
alter table public.events_catalog_provider_links enable row level security;
alter table public.events_catalog_sync_runs enable row level security;
