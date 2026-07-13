-- Kindred — Local Places Cache (Milestone 11)
-- Shared, per-city/metro cache for a real local-places provider (Foursquare
-- first; Google Places later as a fallback). This table is the entire cost
-- control mechanism: it is keyed by (metro_key, category) — never by user —
-- so 10,000 readers opening Kindred in the same city cost the same handful
-- of provider calls as one reader would. Run after 0013_morning_edition.sql.

create table if not exists public.local_places_cache (
  id uuid primary key default gen_random_uuid(),
  -- Normalized "city, ST" (or "city, region, country") key — the sharing
  -- boundary. Never per-user, never per-lat/lon.
  metro_key text not null,
  city text not null,
  region text,
  state text,
  category text not null,
  provider text not null default 'foursquare',
  -- Normalized NormalizedPlace[] + Kindred-written notes, ready to serve.
  places jsonb not null default '[]'::jsonb,
  -- Raw candidate count returned by the provider, for observability only.
  candidate_count integer not null default 0,
  fetched_at timestamptz not null default now(),
  -- Single-flight claim flag: whoever flips this on "wins" the refresh;
  -- everyone else reads the (possibly slightly stale) cached payload
  -- instead of also calling the provider. Cleared when the refresh
  -- finishes (success or failure) so a crashed refresh can't wedge a city.
  refreshing boolean not null default false,
  refreshing_since timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (metro_key, category)
);

comment on table public.local_places_cache is
  'Shared local-places cache, keyed by metro + category (never by user). Backs Recommendations coffee/restaurants/parks/museums/bookstores/scenic drives/attractions with verified provider data. Weekly-or-longer refresh; single-flight claim prevents duplicate provider calls under concurrent load.';
comment on column public.local_places_cache.metro_key is
  'Normalized sharing key, e.g. "gilbert-az". All users in the same metro read the same row.';
comment on column public.local_places_cache.places is
  'NormalizedPlace[] — id, name, address, category, coords, provider url, and Kindred-written note. Never fabricated: every field traces back to the provider response.';
comment on column public.local_places_cache.refreshing is
  'Single-flight claim so a stale cache under concurrent load triggers exactly one provider refresh, not one per reader.';

create index if not exists local_places_cache_metro_idx
  on public.local_places_cache (metro_key);
create index if not exists local_places_cache_fetched_idx
  on public.local_places_cache (fetched_at);
