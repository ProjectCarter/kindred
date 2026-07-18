-- PostgREST upsert (onConflict) requires a non-partial unique index for inference.
-- Partial indexes from 0047 are kept for legacy NULL metro_key rows only.

drop index if exists public.editions_user_date_metro_unique;

create unique index if not exists editions_user_date_metro_unique
  on public.editions (user_id, edition_date, metro_key);
