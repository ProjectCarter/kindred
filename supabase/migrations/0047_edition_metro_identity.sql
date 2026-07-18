-- Edition market identity: one row per user + calendar date + canonical metro_key.
-- Replaces the legacy unique (user_id, edition_date) that caused cross-market overwrites.

alter table public.editions
  add column if not exists metro_key text;

comment on column public.editions.metro_key is
  'Canonical US market key (e.g. phoenix-az, seattle-wa, san-diego-ca). Required for new editions; part of edition identity with user_id and edition_date.';

-- Best-effort backfill from discovery.location when city + state are present.
-- Multi-city Phoenix metro members map to phoenix-az; otherwise city-state slug.
update public.editions e
set metro_key = derived.metro_key
from (
  select
    id,
    case
      when upper(trim(coalesce(discovery->'location'->>'state', ''))) = 'AZ'
        and lower(trim(coalesce(discovery->'location'->>'city', ''))) in (
          'gilbert', 'chandler', 'mesa', 'tempe', 'scottsdale', 'phoenix',
          'glendale', 'peoria', 'surprise', 'goodyear', 'avondale', 'queen creek'
        ) then 'phoenix-az'
      when lower(trim(coalesce(discovery->'location'->>'city', ''))) = 'seattle'
        and upper(trim(coalesce(discovery->'location'->>'state', ''))) = 'WA' then 'seattle-wa'
      when lower(trim(coalesce(discovery->'location'->>'city', ''))) = 'san diego'
        and upper(trim(coalesce(discovery->'location'->>'state', ''))) = 'CA' then 'san-diego-ca'
      when discovery->'location'->>'city' is not null
        and discovery->'location'->>'state' is not null
        then lower(
          regexp_replace(trim(discovery->'location'->>'city'), '[^a-zA-Z0-9]+', '-', 'g')
          || '-'
          || lower(trim(discovery->'location'->>'state'))
        )
      else null
    end as metro_key
  from public.editions
  where metro_key is null
) derived
where e.id = derived.id
  and derived.metro_key is not null;

-- Legacy rows without a reliable market: do not serve as ready (unsafe to scope).
update public.editions
set status = 'failed'
where metro_key is null
  and status = 'ready';

-- Drop legacy uniqueness — one row per user/date was the root cross-market bug.
alter table public.editions
  drop constraint if exists editions_user_id_edition_date_key;

-- At most one unscoped legacy row per user + date (pre-migration leftovers).
create unique index if not exists editions_user_date_legacy_unique
  on public.editions (user_id, edition_date)
  where metro_key is null;

-- Market-scoped editions: Gilbert/Phoenix, Seattle, and San Diego on the same date coexist.
create unique index if not exists editions_user_date_metro_unique
  on public.editions (user_id, edition_date, metro_key)
  where metro_key is not null;

create index if not exists editions_user_date_metro_lookup_idx
  on public.editions (user_id, edition_date, metro_key)
  where metro_key is not null;
