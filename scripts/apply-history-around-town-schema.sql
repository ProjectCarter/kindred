-- History Around Town Library schema (0040).
-- Safe additive migration: new table + editions column only.

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

alter table public.kindred_history_places
  add column if not exists image_photographer text,
  add column if not exists image_era text
    check (image_era is null or image_era in ('historical', 'present_day')),
  add column if not exists image_date text;

comment on column public.kindred_history_places.image_photographer is
  'Verified photographer or institution credited for the image.';
comment on column public.kindred_history_places.image_era is
  'Whether the image is a historical or present-day photograph.';
comment on column public.kindred_history_places.image_date is
  'Date or period of the image when reliably known (e.g. 1925, circa 1913).';

alter table public.kindred_history_places
  add column if not exists image_verification_status text not null default 'pending'
    check (image_verification_status in (
      'pending',
      'verified',
      'verification_pending_rate_limit',
      'verification_pending_transient',
      'failed'
    )),
  add column if not exists image_verification_http_status int,
  add column if not exists image_verification_checked_at timestamptz,
  add column if not exists image_verified_at timestamptz;

comment on column public.kindred_history_places.image_verification_status is
  'HTTP reachability — 429 rate limits never reject editorial approval.';

create index if not exists kindred_history_places_image_verification_idx
  on public.kindred_history_places (image_verification_status)
  where validation_status = 'approved';

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'kindred_history_places'
      and policyname = 'history_places_read_authenticated'
  ) then
    create policy "history_places_read_authenticated"
      on public.kindred_history_places
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'kindred_history_places'
      and policyname = 'history_places_read_anon'
  ) then
    create policy "history_places_read_anon"
      on public.kindred_history_places
      for select
      to anon
      using (true);
  end if;
end $$;

-- v1.1 enrichment columns (0043)
alter table public.kindred_history_places
  add column if not exists phone text,
  add column if not exists year_established text,
  add column if not exists historical_era text,
  add column if not exists historical_metadata_line text,
  add column if not exists historic_designation text,
  add column if not exists historic_designations text[] not null default '{}',
  add column if not exists historical_significance text,
  add column if not exists editorial_introduction text,
  add column if not exists looking_closer text[] not null default '{}',
  add column if not exists timeline_entries jsonb not null default '[]'::jsonb,
  add column if not exists visiting_today_text text,
  add column if not exists before_you_go_text text,
  add column if not exists visit_duration_text text,
  add column if not exists dog_policy_text text,
  add column if not exists google_maps_url text,
  add column if not exists admission_url text,
  add column if not exists nearby_place_slugs text[] not null default '{}';
