-- Shared U.S. national daily editorial layer — one Masterpiece + Today in History per calendar date.

create table if not exists public.kindred_us_national_daily (
  id uuid primary key default gen_random_uuid(),
  edition_date date not null,
  country_code text not null default 'US' check (country_code = 'US'),
  today_masterpiece jsonb,
  masterpiece_artwork_id uuid references public.kindred_hero_artwork (id),
  today_in_history jsonb,
  history_event_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edition_date, country_code)
);

create index if not exists kindred_us_national_daily_date_idx
  on public.kindred_us_national_daily (edition_date desc);

comment on table public.kindred_us_national_daily is
  'One shared U.S. daily editorial record per calendar date — Today''s Masterpiece and Today in History.';

comment on column public.kindred_us_national_daily.today_masterpiece is
  'Frozen MorningHeroExperience + artwork_id for the national day.';

comment on column public.kindred_us_national_daily.today_in_history is
  'Frozen Today in History article, image, and selection metadata for the national day.';

alter table public.editions
  add column if not exists us_national_daily_id uuid
  references public.kindred_us_national_daily (id);

create index if not exists editions_us_national_daily_id_idx
  on public.editions (us_national_daily_id)
  where us_national_daily_id is not null;

alter table public.kindred_us_national_daily enable row level security;

create policy "us_national_daily_read_authenticated"
  on public.kindred_us_national_daily
  for select
  to authenticated
  using (true);

create policy "us_national_daily_read_anon"
  on public.kindred_us_national_daily
  for select
  to anon
  using (true);

-- Idempotent history write — only the first concurrent builder stores copy.
create or replace function public.claim_us_national_history_write(
  p_edition_date date,
  p_country_code text,
  p_history jsonb,
  p_event_key text
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
    today_in_history = p_history,
    history_event_key = p_event_key,
    updated_at = now()
  where edition_date = p_edition_date
    and country_code = coalesce(nullif(trim(p_country_code), ''), 'US')
    and today_in_history is null;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.claim_us_national_history_write(date, text, jsonb, text) from public;
grant execute on function public.claim_us_national_history_write(date, text, jsonb, text) to service_role;
