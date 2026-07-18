-- Kindred US Market Rollout — Version 1 United States only.
-- Ranked market directory + build logs + shared edition slot (no mass generation).

create table if not exists public.kindred_us_markets (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  metro_key text not null unique,
  market_name text not null,
  primary_city text not null,
  state_name text not null,
  state_code char(2) not null,
  country_code char(2) not null default 'US',
  market_type text not null,
  population bigint,
  population_rank integer,
  tourism_rank integer,
  tourism_priority integer not null default 0,
  regional_priority integer not null default 0,
  future_user_demand_score integer not null default 0,
  overall_rank integer not null,
  latitude double precision not null,
  longitude double precision not null,
  timezone text not null,
  default_radius_miles integer not null default 25,
  fallback_radius_miles integer not null default 50,
  metro_cities jsonb not null default '[]'::jsonb,
  status text not null default 'planned',
  is_supported boolean not null default false,
  is_daily_refresh_enabled boolean not null default false,
  build_lock_token text,
  build_lock_expires_at timestamptz,
  last_built_at timestamptz,
  last_refreshed_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text,
  last_build_duration_ms integer,
  completeness jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kindred_us_markets_country_us check (country_code = 'US'),
  constraint kindred_us_markets_market_type check (
    market_type in ('major_metro', 'tourist_destination', 'regional_city')
  ),
  constraint kindred_us_markets_status check (
    status in ('planned', 'building', 'ready', 'needs_attention', 'paused')
  ),
  constraint kindred_us_markets_population_rank_positive check (
    population_rank is null or population_rank > 0
  ),
  constraint kindred_us_markets_overall_rank_positive check (overall_rank > 0)
);

comment on table public.kindred_us_markets is
  'Ranked United States markets for Kindred V1 rollout. country_code must always be US.';

create index if not exists kindred_us_markets_overall_rank_idx
  on public.kindred_us_markets (overall_rank asc);

create index if not exists kindred_us_markets_status_idx
  on public.kindred_us_markets (status);

create index if not exists kindred_us_markets_market_type_idx
  on public.kindred_us_markets (market_type);

create index if not exists kindred_us_markets_state_code_idx
  on public.kindred_us_markets (state_code);

-- Prevent non-US rows at the database layer.
create or replace function public.kindred_us_markets_enforce_us()
returns trigger
language plpgsql
as $$
begin
  if new.country_code is distinct from 'US' then
    raise exception 'Kindred V1 supports United States markets only (country_code must be US)';
  end if;
  return new;
end;
$$;

drop trigger if exists kindred_us_markets_enforce_us_trigger on public.kindred_us_markets;
create trigger kindred_us_markets_enforce_us_trigger
  before insert or update on public.kindred_us_markets
  for each row execute function public.kindred_us_markets_enforce_us();

-- Build / refresh job logging
create table if not exists public.kindred_market_build_logs (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.kindred_us_markets (id) on delete cascade,
  slug text not null,
  state_code char(2) not null,
  country_code char(2) not null default 'US',
  job_type text not null,
  status text not null default 'running',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_ms integer,
  sections_requested jsonb not null default '[]'::jsonb,
  sections_completed jsonb not null default '[]'::jsonb,
  sections_missing jsonb not null default '[]'::jsonb,
  api_providers jsonb not null default '[]'::jsonb,
  api_call_counts jsonb not null default '{}'::jsonb,
  ai_model_usage jsonb,
  token_usage jsonb,
  estimated_cost_usd numeric,
  cost_available boolean not null default false,
  error_details text,
  retry_count integer not null default 0,
  completeness jsonb,
  created_at timestamptz not null default now(),
  constraint kindred_market_build_logs_country_us check (country_code = 'US'),
  constraint kindred_market_build_logs_job_type check (
    job_type in ('build', 'refresh', 'retry')
  ),
  constraint kindred_market_build_logs_status check (
    status in ('running', 'succeeded', 'failed', 'partial')
  )
);

create index if not exists kindred_market_build_logs_market_id_idx
  on public.kindred_market_build_logs (market_id, started_at desc);

-- Nightly batch refresh for shared market editions is intentionally disabled for V1.
-- Per-user editions remain in public.editions; client cache in lib/edition/editionCache.ts.

alter table public.kindred_us_markets enable row level security;
alter table public.kindred_market_build_logs enable row level security;
