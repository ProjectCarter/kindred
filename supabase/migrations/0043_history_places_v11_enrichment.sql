-- History Around Town v1.1 — enriched permanent library fields.
-- Prepare once at ingest; frozen into editions.history_around_town at build time.

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

comment on column public.kindred_history_places.historical_metadata_line is
  'Verified carousel/hero line — e.g. Built in 1917. Omit when unsupported.';
comment on column public.kindred_history_places.timeline_entries is
  'Verified timeline — array of {year, event} objects.';
comment on column public.kindred_history_places.nearby_place_slugs is
  'Slugs of other approved places in this metro for Nearby section linking.';
