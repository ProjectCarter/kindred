-- Today's Masterpiece detail article — stored at ingest, rendered on tap only.

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
