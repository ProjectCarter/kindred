-- Kindred — Food & Drink shared catalog (per-venue, incremental sync)
-- Server-side source of truth for the complete dining guide.
-- Foursquare is queried only by scheduled sync — never per user/session.

-- Metro registry — one row per city Kindred serves.
create table if not exists public.food_drink_catalog_metros (
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

comment on table public.food_drink_catalog_metros is
  'Metros enrolled in the shared Food & Drink catalog. Cron sync runs daily (incremental) and weekly (full reconciliation).';

-- Per-venue catalog — deduped by (metro_key, provider, provider_id).
create table if not exists public.food_drink_catalog (
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
  provider_categories jsonb not null default '[]'::jsonb,
  note text,
  content_fingerprint text not null,
  status text not null default 'active'
    check (status in ('active', 'rejected', 'duplicate', 'possibly_closed')),
  rejection_reason text,
  duplicate_of uuid references public.food_drink_catalog (id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_verified_at timestamptz not null default now(),
  discovered_at timestamptz,
  editorial_note_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (metro_key, provider, provider_id)
);

comment on table public.food_drink_catalog is
  'Shared Food & Drink venue catalog — coffee, restaurants, bakeries within ~25 miles. Grows via daily incremental + weekly full sync.';

create index if not exists food_drink_catalog_metro_status_idx
  on public.food_drink_catalog (metro_key, status);
create index if not exists food_drink_catalog_metro_category_idx
  on public.food_drink_catalog (metro_key, provider_category)
  where status = 'active';
create index if not exists food_drink_catalog_normalized_name_idx
  on public.food_drink_catalog (metro_key, normalized_name);

-- Sync run diagnostics — one row per scheduled scan.
create table if not exists public.food_drink_catalog_sync_runs (
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
  diagnostics jsonb not null default '{}'::jsonb
);

create index if not exists food_drink_catalog_sync_runs_metro_idx
  on public.food_drink_catalog_sync_runs (metro_key, started_at desc);

comment on table public.food_drink_catalog_sync_runs is
  'Observability for daily incremental and weekly full Food & Drink catalog syncs.';

-- RLS: service role only (edge functions use service key).
alter table public.food_drink_catalog_metros enable row level security;
alter table public.food_drink_catalog enable row level security;
alter table public.food_drink_catalog_sync_runs enable row level security;
