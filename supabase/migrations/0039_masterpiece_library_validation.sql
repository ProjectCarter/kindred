-- Masterpiece Library — consolidated validation gate + rotation fields + daily growth cron.

alter table public.kindred_hero_artwork
  add column if not exists validation_status text not null default 'needs_review'
    check (validation_status in ('needs_review', 'approved', 'rejected'));

alter table public.kindred_hero_artwork
  add column if not exists last_shown_date date;

comment on column public.kindred_hero_artwork.validation_status is
  'Edition eligibility: only approved rows may appear in daily selections.';

comment on column public.kindred_hero_artwork.last_shown_date is
  'Calendar date this artwork last appeared in a daily edition (rotation).';

-- Backfill from existing editorial gates.
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

-- Background growth cron intentionally disabled until library QA passes.
-- Enable via scripts/enable-masterpiece-growth-cron.mjs after verification.
