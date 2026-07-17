-- History Around Town — image HTTP verification status (separate from editorial validation_status).

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
  'HTTP reachability check — 429 rate limits never reject editorial approval.';
comment on column public.kindred_history_places.image_verification_http_status is
  'Last HTTP status from image verification probe.';
comment on column public.kindred_history_places.image_verification_checked_at is
  'When the image URL was last probed.';
comment on column public.kindred_history_places.image_verified_at is
  'When the image last returned HTTP 2xx/3xx success.';

create index if not exists kindred_history_places_image_verification_idx
  on public.kindred_history_places (image_verification_status)
  where validation_status = 'approved';
