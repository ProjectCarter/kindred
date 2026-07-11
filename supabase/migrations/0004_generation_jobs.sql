-- Kindred — The Morning Arrives (Milestone 3)
-- Nightly edition generation queue. Run after 0003_editions.sql.

create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  edition_date date not null default current_date,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'ready', 'failed')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, edition_date)
);

create index if not exists generation_jobs_status_date_idx
  on public.generation_jobs (status, edition_date);

alter table public.generation_jobs enable row level security;

-- Jobs are written and processed by Edge Functions with the service role.
-- Authenticated users can see their own job status (e.g. "still preparing").
create policy "Users can view their own generation jobs"
  on public.generation_jobs for select
  using (auth.uid() = user_id);
