-- Kindred — Bandit (Milestone 5)
-- Calm morning companion architecture. No new front-page sections.
-- Run after 0008_personalization.sql.

-- Optional reader identity for Bandit (quiet; never required).
alter table public.profiles
  add column if not exists first_name text;

alter table public.profiles
  add column if not exists birthday_mmdd text;

alter table public.profiles
  add column if not exists home_location jsonb;

alter table public.profiles
  add column if not exists travel jsonb;

comment on column public.profiles.first_name is
  'Optional given name for Bandit greetings.';
comment on column public.profiles.birthday_mmdd is
  'Optional birthday as MM-DD for special-edition mornings.';
comment on column public.profiles.home_location is
  'Usual home {city,region,state,lat,lon} — travel awareness vs current location.';
comment on column public.profiles.travel is
  'Optional trip window {away:boolean, city?, until?, note?} for travel-aware greetings.';

-- Bandit moment for this edition — morning line + reserved future surfaces.
alter table public.editions
  add column if not exists bandit jsonb;

comment on column public.editions.bandit is
  'BanditPayload — morning greeting + reserved weekly/seasonal/editorial notes. Not a new newspaper section.';
