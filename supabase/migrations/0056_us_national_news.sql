-- Shared U.S. National News — one package per calendar date on kindred_us_national_daily.

alter table public.kindred_us_national_daily
  add column if not exists national_news jsonb;

comment on column public.kindred_us_national_daily.national_news is
  'Frozen National News package (3–5 stories) shared by every U.S. city edition for this date.';

alter table public.editions
  add column if not exists national_news jsonb;

comment on column public.editions.national_news is
  'City edition copy of the shared national news package for render compatibility.';

-- Idempotent national-news write — only the first concurrent builder stores copy.
create or replace function public.claim_us_national_news_write(
  p_edition_date date,
  p_country_code text,
  p_national_news jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  insert into public.kindred_us_national_daily (edition_date, country_code)
  values (p_edition_date, coalesce(nullif(trim(p_country_code), ''), 'US'))
  on conflict (edition_date, country_code) do nothing;

  update public.kindred_us_national_daily
  set
    national_news = p_national_news,
    updated_at = now()
  where edition_date = p_edition_date
    and country_code = coalesce(nullif(trim(p_country_code), ''), 'US')
    and national_news is null;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.claim_us_national_news_write(date, text, jsonb) from public;
grant execute on function public.claim_us_national_news_write(date, text, jsonb) to service_role;
