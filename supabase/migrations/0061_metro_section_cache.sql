-- Metro / national section cache — reuse valid content across edition builds.
-- Clearing client AsyncStorage must not invalidate these server-side rows.

create table if not exists public.kindred_metro_section_cache (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('metro', 'national')),
  metro_key text,
  section_type text not null,
  edition_date text,
  national_content_date date,
  payload jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  refresh_after timestamptz not null,
  expires_at timestamptz,
  generation_status text not null default 'complete'
    check (generation_status in ('complete', 'partial', 'failed')),
  validation_status text not null default 'valid'
    check (validation_status in ('valid', 'invalid', 'pending')),
  content_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kindred_metro_section_cache_scope_metro check (
    scope <> 'metro' or metro_key is not null
  ),
  constraint kindred_metro_section_cache_scope_national check (
    scope <> 'national' or national_content_date is not null
  )
);

comment on table public.kindred_metro_section_cache is
  'Shared section payloads keyed by metro or national scope. Prevents redundant Claude calls during edition build.';

create unique index if not exists kindred_metro_section_cache_metro_unique_idx
  on public.kindred_metro_section_cache (metro_key, section_type, edition_date)
  where scope = 'metro' and edition_date is not null;

create unique index if not exists kindred_metro_section_cache_national_unique_idx
  on public.kindred_metro_section_cache (section_type, national_content_date)
  where scope = 'national';

create index if not exists kindred_metro_section_cache_refresh_idx
  on public.kindred_metro_section_cache (section_type, refresh_after desc);

alter table public.kindred_metro_section_cache enable row level security;
