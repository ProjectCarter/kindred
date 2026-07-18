-- Production hardening: RLS on ops tables, storage write lockdown, generation_jobs metro identity.

-- ---------------------------------------------------------------------------
-- 1. Enable RLS on tables previously exposed via PostgREST (service-role only).
-- ---------------------------------------------------------------------------
alter table public.local_places_cache enable row level security;
alter table public.kindred_image_library enable row level security;
alter table public.kindred_image_search_cache enable row level security;
alter table public.kindred_hero_artwork enable row level security;
alter table public.kindred_hero_artwork_collections enable row level security;
alter table public.kindred_market_build_checkpoints enable row level security;
alter table public.kindred_market_editorial_note_queue enable row level security;

comment on table public.local_places_cache is
  'Per-metro places cache — service role only (RLS enabled, no client policies).';

-- ---------------------------------------------------------------------------
-- 2. generation_jobs metro_key — align with editions (0047/0048).
-- ---------------------------------------------------------------------------
alter table public.generation_jobs
  add column if not exists metro_key text;

comment on column public.generation_jobs.metro_key is
  'Canonical US market key for the edition being built. Part of job identity with user_id and edition_date.';

-- Backfill from matching edition rows when available.
update public.generation_jobs gj
set metro_key = e.metro_key
from public.editions e
where gj.user_id = e.user_id
  and gj.edition_date = e.edition_date
  and gj.metro_key is null
  and e.metro_key is not null;

alter table public.generation_jobs
  drop constraint if exists generation_jobs_user_id_edition_date_key;

drop index if exists public.generation_jobs_user_date_idx;

create unique index if not exists generation_jobs_user_date_metro_unique
  on public.generation_jobs (user_id, edition_date, metro_key);

create index if not exists generation_jobs_user_date_metro_lookup_idx
  on public.generation_jobs (user_id, edition_date, metro_key);

create index if not exists generation_jobs_status_date_metro_idx
  on public.generation_jobs (status, edition_date, metro_key);

-- ---------------------------------------------------------------------------
-- 3. Tighten history library reads — approved content only (matches city articles).
-- ---------------------------------------------------------------------------
drop policy if exists history_places_read_authenticated on public.kindred_history_places;
drop policy if exists history_places_read_anon on public.kindred_history_places;

create policy history_places_read_authenticated
  on public.kindred_history_places for select
  to authenticated
  using (
    validation_status = 'approved'
    and approval_status = 'approved'
  );

create policy history_places_read_anon
  on public.kindred_history_places for select
  to anon
  using (
    validation_status = 'approved'
    and approval_status = 'approved'
  );

-- ---------------------------------------------------------------------------
-- 4. Catalog query indexes for edition-build hot paths.
-- ---------------------------------------------------------------------------
create index if not exists events_catalog_metro_verified_start_idx
  on public.events_catalog (metro_key, start_at)
  where verification_status = 'verified';

create index if not exists kindred_market_build_logs_run_id_idx
  on public.kindred_market_build_logs (run_id);

-- ---------------------------------------------------------------------------
-- 5. Storage write policies — service_role only (replace world-writable policies).
-- ---------------------------------------------------------------------------
drop policy if exists "kindred_images_service_write" on storage.objects;
drop policy if exists "kindred_images_service_update" on storage.objects;

create policy "kindred_images_service_write"
  on storage.objects for insert
  to service_role
  with check (bucket_id = 'kindred-images');

create policy "kindred_images_service_update"
  on storage.objects for update
  to service_role
  using (bucket_id = 'kindred-images');

drop policy if exists "kindred_hero_artwork_service_write" on storage.objects;
drop policy if exists "kindred_hero_artwork_service_update" on storage.objects;

create policy "kindred_hero_artwork_service_write"
  on storage.objects for insert
  to service_role
  with check (bucket_id = 'kindred-hero-artwork');

create policy "kindred_hero_artwork_service_update"
  on storage.objects for update
  to service_role
  using (bucket_id = 'kindred-hero-artwork');
