-- Hero artwork mobile display dimensions — frozen at ingest time to prevent layout shift.

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
