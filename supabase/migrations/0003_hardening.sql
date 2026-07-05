-- Kindred — Hardening milestone schema
-- Run this once in the Supabase SQL Editor after 0002_insights.sql.

-- Background jobs for async insight generation (one job per item).
create table if not exists public.insight_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  status text not null check (status in ('pending', 'processing', 'completed', 'failed')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id)
);

create index if not exists insight_jobs_user_status_idx
  on public.insight_jobs (user_id, status);

create index if not exists insight_jobs_pending_idx
  on public.insight_jobs (status, updated_at)
  where status in ('pending', 'failed');

-- Append-only log used for per-user rate limiting.
create table if not exists public.insight_generation_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists insight_generation_log_user_created_idx
  on public.insight_generation_log (user_id, created_at desc);

alter table public.insight_jobs enable row level security;
alter table public.insight_generation_log enable row level security;

create policy "Users can view their own insight jobs"
  on public.insight_jobs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own insight jobs"
  on public.insight_jobs for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.items
      where items.id = item_id
        and items.user_id = auth.uid()
    )
  );

create policy "Users can update their own insight jobs"
  on public.insight_jobs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can view their own insight generation log"
  on public.insight_generation_log for select
  using (auth.uid() = user_id);

create policy "Users can insert their own insight generation log"
  on public.insight_generation_log for insert
  with check (auth.uid() = user_id);
