-- History Around Town — authentic image provenance (no AI-generated images).

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
