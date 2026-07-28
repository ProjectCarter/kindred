-- Deals platform — shared backend foundation for the app and website (D.R.O.P.).
--
-- Two-layer model:
--   1. Raw catalog (service-role only): affiliate connectors write here.
--      deals_catalog_metros · deals_catalog · deals_catalog_sync_runs ·
--      deals_catalog_provider_links
--   2. Published projection (anon-readable, curated): deals_published — the single
--      source both the mobile app and the website read via the anon key. Filter,
--      sort, paginate, and geo-target all run in the database. Expired deals are
--      hidden automatically by the RLS SELECT policy (ends_at > now()).
--
-- No affiliate network is ever contacted during a page load. Sync + publish run
-- outside user requests (edge functions + pg_cron, added in a later migration).

-- ---------------------------------------------------------------------------
-- Layer 1 — raw catalog (service role only)
-- ---------------------------------------------------------------------------

-- Local-deal metro registry (online / nationwide deals carry no metro).
create table if not exists public.deals_catalog_metros (
  metro_key text primary key,
  city text not null,
  region text,
  state text,
  lat double precision,
  lon double precision,
  initial_import_completed_at timestamptz,
  last_full_sync_at timestamptz,
  last_incremental_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per raw affiliate offer, deduped by (provider, provider_id).
create table if not exists public.deals_catalog (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'local'
    check (scope in ('local', 'online', 'nationwide')),
  metro_key text,
  provider text not null,
  provider_id text not null,
  provider_category text,
  category text not null,
  deal_type text,
  discount_type text,
  merchant text not null,
  normalized_merchant text not null,
  title text not null,
  savings_label text,
  description text,
  savings_detail text,
  known_for text,
  highlights jsonb not null default '[]'::jsonb,
  terms text,
  voucher_code text,
  city text,
  state text,
  lat double precision,
  lon double precision,
  website text,
  redeem_url text,
  image_url text,
  content_fingerprint text not null,
  quality_score numeric,
  lifecycle text not null default 'new'
    check (lifecycle in (
      'new', 'verified', 'featured', 'evergreen',
      'needs_review', 'expired', 'rejected', 'duplicate'
    )),
  status text not null default 'active'
    check (status in ('active', 'rejected', 'duplicate', 'expired')),
  rejection_reason text,
  duplicate_of uuid references public.deals_catalog (id) on delete set null,
  starts_at timestamptz,
  ends_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_id)
);

comment on table public.deals_catalog is
  'Raw affiliate offer catalog (CJ / Awin / Impact / PartnerStack / direct). Service-role only; never read by clients.';

create index if not exists deals_catalog_metro_status_idx
  on public.deals_catalog (metro_key, status);
create index if not exists deals_catalog_scope_category_idx
  on public.deals_catalog (scope, category)
  where status = 'active';
create index if not exists deals_catalog_lifecycle_idx
  on public.deals_catalog (lifecycle);
create index if not exists deals_catalog_ends_at_idx
  on public.deals_catalog (ends_at);
create index if not exists deals_catalog_normalized_merchant_idx
  on public.deals_catalog (normalized_merchant);

-- External provider IDs that resolve to the same Kindred deal record.
create table if not exists public.deals_catalog_provider_links (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals_catalog (id) on delete cascade,
  provider text not null,
  provider_id text not null,
  provider_category text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (provider, provider_id)
);

-- Per-run sync + publish diagnostics.
create table if not exists public.deals_catalog_sync_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  mode text not null check (mode in ('incremental', 'full', 'publish')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  api_calls integer not null default 0,
  raw_deals_returned integer not null default 0,
  new_discovered integer not null default 0,
  changed_updated integer not null default 0,
  expired_removed integer not null default 0,
  published_count integer not null default 0,
  rejected integer not null default 0,
  ok boolean,
  error text,
  diagnostics jsonb not null default '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- Layer 2 — published projection (anon-readable, curated)
-- ---------------------------------------------------------------------------

create table if not exists public.deals_published (
  id uuid primary key,
  deal_key text not null unique,
  scope text not null
    check (scope in ('local', 'online', 'nationwide')),
  region_key text,
  category text not null,
  deal_type text,
  discount_type text,
  emoji text not null,
  merchant text not null,
  title text not null,
  savings_label text not null,
  description text not null,
  savings_detail text not null default '',
  known_for text,
  highlights jsonb not null default '[]'::jsonb,
  city text,
  state text,
  lat double precision,
  lon double precision,
  website text,
  redeem_url text,
  source text,
  terms text,
  voucher_code text,
  image_url text,
  featured_rank integer,
  quality_score numeric,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'published'
    check (status in ('published', 'archived')),
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.deals_published is
  'Curated, denormalized, anon-readable projection of deals_catalog. The single source the app and website read. Expired deals are hidden by the RLS SELECT policy.';

-- Category / scope / region filtering (indexed metadata, not JSON).
create index if not exists deals_published_scope_region_category_idx
  on public.deals_published (scope, region_key, category)
  where status = 'published';

-- Homepage featured selection.
create index if not exists deals_published_featured_idx
  on public.deals_published (scope, region_key, featured_rank)
  where status = 'published' and featured_rank is not null;

-- Quality ordering for See All.
create index if not exists deals_published_quality_idx
  on public.deals_published (scope, region_key, quality_score desc)
  where status = 'published';

-- Expiry sweeps.
create index if not exists deals_published_ends_at_idx
  on public.deals_published (ends_at);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

-- Raw layer: service role only (no policies).
alter table public.deals_catalog_metros enable row level security;
alter table public.deals_catalog enable row level security;
alter table public.deals_catalog_provider_links enable row level security;
alter table public.deals_catalog_sync_runs enable row level security;

-- Published layer: anon + authenticated may read only live, published deals.
alter table public.deals_published enable row level security;

create policy "deals_published_read_anon"
  on public.deals_published
  for select
  to anon
  using (
    status = 'published'
    and (ends_at is null or ends_at > now())
    and (starts_at is null or starts_at <= now())
  );

create policy "deals_published_read_authenticated"
  on public.deals_published
  for select
  to authenticated
  using (
    status = 'published'
    and (ends_at is null or ends_at > now())
    and (starts_at is null or starts_at <= now())
  );

-- ---------------------------------------------------------------------------
-- Geo query — nearby published deals (haversine; no PostGIS dependency).
-- security definer, so it re-applies the published + live filter itself.
-- ---------------------------------------------------------------------------

create or replace function public.deals_nearby(
  p_lat double precision,
  p_lon double precision,
  p_radius_km double precision default 40,
  p_category text default null,
  p_limit integer default 30,
  p_offset integer default 0
)
returns setof public.deals_published
language sql
stable
security definer
set search_path = public
as $$
  select d.*
  from public.deals_published d
  where d.status = 'published'
    and (d.ends_at is null or d.ends_at > now())
    and (d.starts_at is null or d.starts_at <= now())
    and d.lat is not null
    and d.lon is not null
    and (p_category is null or d.category = p_category)
    -- bounding-box prefilter (~111 km per degree latitude)
    and d.lat between p_lat - (p_radius_km / 111.0)
                  and p_lat + (p_radius_km / 111.0)
    and d.lon between p_lon - (p_radius_km / (111.0 * greatest(cos(radians(p_lat)), 0.01)))
                  and p_lon + (p_radius_km / (111.0 * greatest(cos(radians(p_lat)), 0.01)))
    and (
      6371.0 * acos(
        least(1.0, greatest(-1.0,
          cos(radians(p_lat)) * cos(radians(d.lat))
            * cos(radians(d.lon) - radians(p_lon))
          + sin(radians(p_lat)) * sin(radians(d.lat))
        ))
      )
    ) <= p_radius_km
  order by
    d.featured_rank asc nulls last,
    (
      6371.0 * acos(
        least(1.0, greatest(-1.0,
          cos(radians(p_lat)) * cos(radians(d.lat))
            * cos(radians(d.lon) - radians(p_lon))
          + sin(radians(p_lat)) * sin(radians(d.lat))
        ))
      )
    ) asc,
    d.quality_score desc nulls last
  limit greatest(1, least(coalesce(p_limit, 30), 100))
  offset greatest(0, coalesce(p_offset, 0));
$$;

comment on function public.deals_nearby(double precision, double precision, double precision, text, integer, integer) is
  'Live published deals within p_radius_km of (p_lat, p_lon), nearest first. Re-applies the published + non-expired filter (security definer).';

revoke all on function public.deals_nearby(double precision, double precision, double precision, text, integer, integer) from public;
grant execute on function public.deals_nearby(double precision, double precision, double precision, text, integer, integer)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Bounded count — powers the "0 / exact 1–99 / 100+" homepage badge without
-- ever scanning the whole table. The inner LIMIT 101 caps the work at 101 rows
-- regardless of catalog size, so counting stays O(1) as Deals grows. Local
-- deals for the metro plus everything nationwide / online (mirrors client reads).
-- ---------------------------------------------------------------------------

create or replace function public.count_published_deals(
  p_region_key text default null,
  p_category text default null
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from (
    select 1
    from public.deals_published d
    where d.status = 'published'
      and (d.ends_at is null or d.ends_at > now())
      and (d.starts_at is null or d.starts_at <= now())
      and (p_category is null or d.category = p_category)
      and (
        p_region_key is null
        or d.region_key = p_region_key
        or d.scope in ('online', 'nationwide')
      )
    limit 101
  ) s;
$$;

comment on function public.count_published_deals(text, text) is
  'Live published deal count, capped at 101 (inner LIMIT) so callers can render exact 1–99 or "100+" without a full-table count. Re-applies the published + non-expired filter (security definer).';

revoke all on function public.count_published_deals(text, text) from public;
grant execute on function public.count_published_deals(text, text)
  to anon, authenticated, service_role;
