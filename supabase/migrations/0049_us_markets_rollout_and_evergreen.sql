-- U.S. Market Expansion System — rollout metadata + evergreen asset storage.
-- Does NOT generate editions or batch-build markets.

-- Rollout catalog columns
alter table public.kindred_us_markets
  add column if not exists display_name text,
  add column if not exists population_tier text,
  add column if not exists national_significance_score integer not null default 0,
  add column if not exists rollout_priority integer;

comment on column public.kindred_us_markets.display_name is
  'Reader-facing market label (e.g. Seattle, Sedona).';

comment on column public.kindred_us_markets.population_tier is
  'Rollout tier: tier_1_national | tier_2_major | tier_3_regional | tier_4_emerging | tourist_destination';

comment on column public.kindred_us_markets.rollout_priority is
  'Explicit rollout sequence — mirrors overall_rank after seeding.';

update public.kindred_us_markets
set
  display_name = coalesce(display_name, primary_city),
  rollout_priority = coalesce(rollout_priority, overall_rank)
where display_name is null or rollout_priority is null;

alter table public.kindred_us_markets
  drop constraint if exists kindred_us_markets_status;

alter table public.kindred_us_markets
  add constraint kindred_us_markets_status check (
    status in ('planned', 'building', 'ready', 'complete', 'needs_attention', 'paused')
  );

alter table public.kindred_us_markets
  drop constraint if exists kindred_us_markets_population_tier;

alter table public.kindred_us_markets
  add constraint kindred_us_markets_population_tier check (
    population_tier is null or population_tier in (
      'tier_1_national',
      'tier_2_major',
      'tier_3_regional',
      'tier_4_emerging',
      'tourist_destination'
    )
  );

create index if not exists kindred_us_markets_rollout_priority_idx
  on public.kindred_us_markets (rollout_priority asc nulls last);

-- Evergreen content — store once, reuse across editions (Phase 4).
create table if not exists public.kindred_market_evergreen_assets (
  id uuid primary key default gen_random_uuid(),
  metro_key text not null,
  asset_type text not null,
  slug text not null,
  title text not null,
  summary text,
  body jsonb,
  latitude double precision,
  longitude double precision,
  source_uri text,
  license_note text,
  approval_status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kindred_market_evergreen_assets_type check (
    asset_type in (
      'city_history',
      'landmark',
      'museum',
      'park',
      'viewpoint',
      'artwork',
      'historic_district',
      'attraction'
    )
  ),
  constraint kindred_market_evergreen_assets_approval check (
    approval_status in ('draft', 'review', 'approved', 'archived')
  ),
  constraint kindred_market_evergreen_assets_unique unique (metro_key, asset_type, slug)
);

comment on table public.kindred_market_evergreen_assets is
  'Permanent metro-scoped evergreen content — city history, landmarks, museums, parks, viewpoints, artwork, districts, attractions. Stored once and reused; never regenerated per edition.';

create index if not exists kindred_market_evergreen_assets_metro_idx
  on public.kindred_market_evergreen_assets (metro_key, asset_type, approval_status);

alter table public.kindred_market_evergreen_assets enable row level security;

-- Links evergreen rows to existing editorial libraries (optional backfill targets).
comment on column public.kindred_market_evergreen_assets.metadata is
  'Optional pointers: kindred_city_articles.id, kindred_history_places.id, hero_artwork_library.id';
