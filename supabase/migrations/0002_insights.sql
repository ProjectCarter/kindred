-- Kindred — Milestone 2 schema (Phase 1)
-- Run this once in the Supabase SQL Editor after 0001_init.sql.

-- Insights: Kindred's honest reflections on things a person owns.
-- One insight per item for Milestone 2; the schema leaves room to add
-- columns (e.g. updated_at, generation metadata) in later migrations.
create table if not exists public.insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  unique (item_id)
);

create index if not exists insights_user_id_idx
  on public.insights (user_id);

alter table public.insights enable row level security;

create policy "Users can view their own insights"
  on public.insights for select
  using (auth.uid() = user_id);

create policy "Users can insert their own insights"
  on public.insights for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.items
      where items.id = item_id
        and items.user_id = auth.uid()
    )
  );
