-- History Around Town — permanent metro-scoped editorial library.
-- Prepare once at ingest; edition build copies frozen snapshots only.

create table if not exists public.kindred_history_places (
  id uuid primary key default gen_random_uuid(),
  internal_id text not null unique,
  metro_key text not null,
  place_name text not null,
  slug text not null,
  category text not null
    check (category in (
      'historic_district', 'historic_home', 'museum', 'monument', 'memorial',
      'courthouse', 'church', 'school', 'train_depot', 'bridge', 'military_site',
      'archaeological_site', 'historic_cemetery', 'neighborhood', 'observatory',
      'lighthouse', 'public_art', 'landmark'
    )),
  category_label text not null,
  editorial_teaser text not null,
  story_body text not null,
  editorial_modules jsonb not null default '[]'::jsonb,
  closing_note text,
  history_summary text,
  why_it_matters text,
  interesting_facts text[] not null default '{}',
  architecture_note text,
  best_time_to_visit text,
  hours_text text,
  admission_text text,
  parking_text text,
  accessibility_text text,
  nearby_places text[] not null default '{}',
  lat double precision,
  lon double precision,
  address text,
  city text,
  state text,
  image_url text,
  hosted_url text,
  storage_path text,
  image_credit text,
  image_source_url text,
  image_license text,
  official_website text,
  source_urls jsonb not null default '[]'::jsonb,
  source_provider text not null default 'manual',
  source_provider_place_id text,
  validation_status text not null default 'needs_review'
    check (validation_status in ('needs_review', 'approved', 'rejected')),
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  editorial_priority integer not null default 50
    check (editorial_priority between 1 and 100),
  featured boolean not null default false,
  last_reviewed_at timestamptz,
  last_shown_date date,
  use_count integer not null default 0,
  verified_at timestamptz,
  verified_by text,
  verification_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (metro_key, slug)
);

comment on table public.kindred_history_places is
  'Permanent History Around Town library — metro-scoped historic places with pre-written articles.';

create index if not exists kindred_history_places_metro_approved_idx
  on public.kindred_history_places (metro_key, validation_status, editorial_priority desc)
  where validation_status = 'approved';

create index if not exists kindred_history_places_metro_category_idx
  on public.kindred_history_places (metro_key, category)
  where validation_status = 'approved';

alter table public.editions
  add column if not exists history_around_town jsonb;

comment on column public.editions.history_around_town is
  'Frozen History Around Town snapshot for this edition — carousel + full directory.';

alter table public.kindred_history_places enable row level security;

create policy "history_places_read_authenticated"
  on public.kindred_history_places
  for select
  to authenticated
  using (true);

create policy "history_places_read_anon"
  on public.kindred_history_places
  for select
  to anon
  using (true);
