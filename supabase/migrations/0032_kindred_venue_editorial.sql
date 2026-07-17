-- Kindred Editorial Database — venue provenance, lifecycle, multi-provider links.
-- food_drink_catalog rows ARE Kindred venue records (permanent Kindred UUID = id).
-- Provider APIs feed the discovery pipeline; Kindred owns the editorial record.

-- Editorial lifecycle + provenance columns on the venue catalog.
alter table public.food_drink_catalog
  add column if not exists lifecycle text not null default 'new'
    check (lifecycle in (
      'new', 'verified', 'featured', 'evergreen',
      'needs_review', 'closed', 'rejected', 'duplicate'
    )),
  add column if not exists phone text,
  add column if not exists cuisine text,
  add column if not exists editorial_categories jsonb not null default '[]'::jsonb,
  add column if not exists editorial_tags jsonb not null default '[]'::jsonb,
  add column if not exists editorial_teaser text,
  add column if not exists editorial_article text,
  add column if not exists opening_hours jsonb,
  add column if not exists price_level smallint,
  add column if not exists photos jsonb not null default '[]'::jsonb,
  add column if not exists confidence_score smallint not null default 0
    check (confidence_score >= 0 and confidence_score <= 100),
  add column if not exists verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'needs_review', 'rejected')),
  add column if not exists field_sources jsonb not null default '{}'::jsonb,
  add column if not exists source_history jsonb not null default '[]'::jsonb;

comment on column public.food_drink_catalog.id is
  'Permanent Kindred venue ID — never changes, even when providers are swapped.';
comment on column public.food_drink_catalog.lifecycle is
  'Editorial lifecycle: new → verified → featured → evergreen → needs_review → closed.';
comment on column public.food_drink_catalog.field_sources is
  'Source Manager snapshot — each field stores value, source, confidence, alternatives.';
comment on column public.food_drink_catalog.source_history is
  'Append-only audit trail of provider observations and merge decisions.';

-- Backfill lifecycle from legacy status column.
update public.food_drink_catalog
set lifecycle = case status
  when 'active' then 'verified'
  when 'possibly_closed' then 'needs_review'
  when 'rejected' then 'rejected'
  when 'duplicate' then 'duplicate'
  else 'new'
end
where lifecycle = 'new' and status is not null;

update public.food_drink_catalog
set verification_status = case lifecycle
  when 'verified' then 'verified'
  when 'featured' then 'verified'
  when 'evergreen' then 'verified'
  when 'needs_review' then 'needs_review'
  when 'rejected' then 'rejected'
  when 'closed' then 'verified'
  else 'pending'
end;

-- Copy legacy note into editorial_teaser when present.
update public.food_drink_catalog
set editorial_teaser = note
where editorial_teaser is null and note is not null;

create index if not exists food_drink_catalog_metro_lifecycle_idx
  on public.food_drink_catalog (metro_key, lifecycle)
  where lifecycle in ('verified', 'featured', 'evergreen');

-- Multi-provider links — every importer merges into the same Kindred venue.
create table if not exists public.kindred_venue_provider_links (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.food_drink_catalog (id) on delete cascade,
  metro_key text not null,
  provider text not null,
  provider_id text not null,
  provider_category text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (metro_key, provider, provider_id)
);

create index if not exists kindred_venue_provider_links_venue_idx
  on public.kindred_venue_provider_links (venue_id);

comment on table public.kindred_venue_provider_links is
  'Maps external provider IDs to Kindred venue records. Enables Foursquare, Google, Yelp, etc. without duplicates.';

-- Backfill Foursquare links from existing catalog rows.
insert into public.kindred_venue_provider_links (venue_id, metro_key, provider, provider_id, provider_category, last_seen_at)
select id, metro_key, provider, provider_id, provider_category, last_verified_at
from public.food_drink_catalog
on conflict (metro_key, provider, provider_id) do nothing;

alter table public.kindred_venue_provider_links enable row level security;
