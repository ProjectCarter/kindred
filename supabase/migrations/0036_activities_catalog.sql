-- Kindred — Activities shared catalog (per-venue, scheduled sync)
-- Server-side source of truth for the Activities desk.
-- Foursquare is queried only by scheduled sync — never per user/session.

create table if not exists public.activities_catalog_metros (
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

comment on table public.activities_catalog_metros is
  'Metros enrolled in the shared Activities catalog. Full sync weekly; incremental daily.';

create table if not exists public.activities_catalog (
  id uuid primary key default gen_random_uuid(),
  metro_key text not null,
  provider text not null default 'foursquare',
  provider_id text not null,
  provider_category text not null,
  name text not null,
  normalized_name text not null,
  address text,
  city text,
  state text,
  lat double precision,
  lon double precision,
  url text,
  phone text,
  opening_hours jsonb,
  price_level integer,
  provider_categories jsonb not null default '[]'::jsonb,
  experience_fingerprint text,
  content_fingerprint text not null,
  lifecycle text not null default 'discovered'
    check (lifecycle in (
      'discovered', 'verified', 'active', 'featured', 'needs_review',
      'inactive', 'archived', 'rejected', 'duplicate'
    )),
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'needs_review', 'rejected')),
  confidence_score integer not null default 0,
  field_sources jsonb not null default '{}'::jsonb,
  source_history jsonb not null default '[]'::jsonb,
  editorial_teaser text,
  editorial_article text,
  note text,
  status text not null default 'active'
    check (status in ('active', 'rejected', 'duplicate', 'possibly_closed')),
  rejection_reason text,
  duplicate_of uuid references public.activities_catalog (id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_verified_at timestamptz not null default now(),
  last_material_change_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (metro_key, provider, provider_id)
);

comment on table public.activities_catalog is
  'Shared Activities venue catalog — experiences within ~25 miles. Closed venues marked inactive, not deleted.';

create index if not exists activities_catalog_metro_lifecycle_idx
  on public.activities_catalog (metro_key, lifecycle)
  where lifecycle in ('verified', 'active', 'featured');
create index if not exists activities_catalog_metro_category_idx
  on public.activities_catalog (metro_key, provider_category)
  where lifecycle in ('verified', 'active', 'featured');
create index if not exists activities_catalog_normalized_name_idx
  on public.activities_catalog (metro_key, normalized_name);

create table if not exists public.activities_catalog_sync_runs (
  id uuid primary key default gen_random_uuid(),
  metro_key text not null,
  mode text not null check (mode in ('incremental', 'full')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  api_calls integer not null default 0,
  raw_places_returned integer not null default 0,
  existing_skipped integer not null default 0,
  new_discovered integer not null default 0,
  changed_updated integer not null default 0,
  duplicates_merged integer not null default 0,
  places_rejected integer not null default 0,
  editorial_queued integer not null default 0,
  estimated_cost_usd numeric(10, 6),
  run_duration_ms integer,
  next_scheduled_at timestamptz,
  diagnostics jsonb not null default '{}'::jsonb
);

create index if not exists activities_catalog_sync_runs_metro_idx
  on public.activities_catalog_sync_runs (metro_key, started_at desc);

alter table public.activities_catalog_metros enable row level security;
alter table public.activities_catalog enable row level security;
alter table public.activities_catalog_sync_runs enable row level security;
