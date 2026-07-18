-- U.S. Market Build Engine — checkpoints, deferred editorial notes, extended build logs.
-- Additive only. Does not modify or delete existing catalog or market rows.

-- Phase checkpoints for resumable market builds
create table if not exists public.kindred_market_build_checkpoints (
  id uuid primary key default gen_random_uuid(),
  metro_key text not null,
  slug text not null,
  run_id uuid not null,
  catalog text not null,
  phase text not null,
  checkpoint text,
  status text not null default 'pending',
  attempts integer not null default 0,
  rows_imported integer not null default 0,
  api_calls integer not null default 0,
  worker_exit_reason text,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kindred_market_build_checkpoints_catalog check (
    catalog in ('events', 'activities', 'food_drinks', 'orchestrator')
  ),
  constraint kindred_market_build_checkpoints_phase check (
    phase in ('preflight', 'events', 'activities', 'food_drinks', 'reconcile', 'validate', 'finalize')
  ),
  constraint kindred_market_build_checkpoints_status check (
    status in ('pending', 'running', 'completed', 'failed', 'skipped')
  )
);

comment on table public.kindred_market_build_checkpoints is
  'Durable checkpoints for phased U.S. market builds — one row per phase or per activity category.';

create unique index if not exists kindred_market_build_checkpoints_run_phase_uq
  on public.kindred_market_build_checkpoints (run_id, phase, coalesce(checkpoint, ''));

create index if not exists kindred_market_build_checkpoints_metro_idx
  on public.kindred_market_build_checkpoints (metro_key, run_id, phase);

-- Deferred editorial note backfill queue (non-blocking for COMPLETE gate)
create table if not exists public.kindred_market_editorial_note_queue (
  id uuid primary key default gen_random_uuid(),
  metro_key text not null,
  catalog text not null,
  provider_id text not null,
  provider_category text not null,
  city text not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kindred_market_editorial_note_queue_catalog check (
    catalog in ('activities', 'food_drinks')
  ),
  constraint kindred_market_editorial_note_queue_status check (
    status in ('pending', 'processing', 'completed', 'failed')
  ),
  constraint kindred_market_editorial_note_queue_unique unique (metro_key, catalog, provider_id)
);

create index if not exists kindred_market_editorial_note_queue_pending_idx
  on public.kindred_market_editorial_note_queue (status, created_at)
  where status = 'pending';

-- Deferred-note markers on catalog rows (editorial quality still passes via confidence_score)
alter table public.activities_catalog
  add column if not exists editorial_note_pending boolean not null default false;

alter table public.food_drink_catalog
  add column if not exists editorial_note_pending boolean not null default false;

comment on column public.activities_catalog.editorial_note_pending is
  'True when Bandit note backfill is queued — confidence_score satisfies validation without note.';

comment on column public.food_drink_catalog.editorial_note_pending is
  'True when Bandit note backfill is queued — confidence_score satisfies validation without note.';

-- Extended build log telemetry for morning reports
alter table public.kindred_market_build_logs
  add column if not exists run_id uuid,
  add column if not exists phase text,
  add column if not exists checkpoint text,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists rows_imported integer not null default 0,
  add column if not exists worker_exit_reason text,
  add column if not exists warnings jsonb not null default '[]'::jsonb;

comment on column public.kindred_market_build_logs.phase is
  'Orchestrator phase: preflight | events | activities | food_drinks | reconcile | validate | finalize';

alter table public.kindred_market_build_logs enable row level security;
