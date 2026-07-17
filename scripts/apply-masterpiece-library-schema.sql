-- Masterpiece Library schema prerequisites (0024–0026) + validation (0039, no cron).
-- Safe additive migration: preserves all rows, freeze table, use_count, rotation history.

-- 0024 image dimensions
alter table public.kindred_hero_artwork
  add column if not exists image_width int
    check (image_width is null or image_width between 400 and 2400),
  add column if not exists image_height int
    check (image_height is null or image_height between 300 and 2400),
  add column if not exists aspect_ratio numeric(10, 6)
    check (aspect_ratio is null or aspect_ratio > 0);

create index if not exists kindred_hero_artwork_dimensions_idx
  on public.kindred_hero_artwork (image_width, image_height)
  where hosted_url is not null;

-- 0025 masterpiece detail article fields
alter table public.kindred_hero_artwork
  add column if not exists long_story_body text,
  add column if not exists long_story_paragraph_count int,
  add column if not exists artist_biography text,
  add column if not exists look_closer_items text[] not null default '{}',
  add column if not exists did_you_know text,
  add column if not exists museum_name text,
  add column if not exists museum_location text,
  add column if not exists official_museum_url text,
  add column if not exists official_artwork_url text,
  add column if not exists source_references jsonb not null default '[]'::jsonb,
  add column if not exists detail_editorial_status text not null default 'pending'
    check (detail_editorial_status in ('pending', 'approved', 'rejected'));

create index if not exists kindred_hero_artwork_detail_ready_idx
  on public.kindred_hero_artwork (detail_editorial_status, approval_status)
  where detail_editorial_status = 'approved';

-- 0026 structured editorial sections
alter table public.kindred_hero_artwork
  add column if not exists editorial_sections jsonb;

-- 0039 validation + rotation
alter table public.kindred_hero_artwork
  add column if not exists validation_status text not null default 'needs_review'
    check (validation_status in ('needs_review', 'approved', 'rejected'));

alter table public.kindred_hero_artwork
  add column if not exists last_shown_date date;

comment on column public.kindred_hero_artwork.validation_status is
  'Edition eligibility: only approved rows may appear in daily selections.';

comment on column public.kindred_hero_artwork.last_shown_date is
  'Calendar date this artwork last appeared in a daily edition (rotation).';

update public.kindred_hero_artwork
set validation_status = 'rejected'
where approval_status = 'rejected'
   or detail_editorial_status = 'rejected'
   or public_domain_status = 'rejected'
   or curator_editorial_status = 'rejected';

update public.kindred_hero_artwork
set validation_status = 'approved'
where validation_status = 'needs_review'
  and approval_status = 'approved'
  and detail_editorial_status = 'approved'
  and curator_editorial_status = 'approved'
  and public_domain_status = 'verified'
  and commercial_use_confirmed = true
  and hosted_url is not null
  and storage_path is not null
  and about_artwork_body is not null
  and long_story_body is not null;

update public.kindred_hero_artwork
set last_shown_date = (last_used_at at time zone 'UTC')::date
where last_used_at is not null
  and last_shown_date is null;

create index if not exists kindred_hero_artwork_validation_ready_idx
  on public.kindred_hero_artwork (validation_status, last_shown_date nulls first)
  where validation_status = 'approved';

-- 0038 read policies (idempotent)
alter table public.kindred_hero_artwork_edition_selections enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'kindred_hero_artwork_edition_selections'
      and policyname = 'hero_artwork_selections_read_authenticated'
  ) then
    create policy "hero_artwork_selections_read_authenticated"
      on public.kindred_hero_artwork_edition_selections
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'kindred_hero_artwork_edition_selections'
      and policyname = 'hero_artwork_selections_read_anon'
  ) then
    create policy "hero_artwork_selections_read_anon"
      on public.kindred_hero_artwork_edition_selections
      for select
      to anon
      using (true);
  end if;
end $$;
