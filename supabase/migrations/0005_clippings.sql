-- Kindred — Personal Library & Clippings (Milestone 4)
-- Run after 0003_editions.sql (and 0004 if present).

create table if not exists public.clippings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  section_id uuid not null references public.edition_sections(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, section_id)
);

create index if not exists clippings_user_id_created_at_idx
  on public.clippings (user_id, created_at desc);

alter table public.clippings enable row level security;

create policy "Users can view their own clippings"
  on public.clippings for select
  using (auth.uid() = user_id);

create policy "Users can save their own clippings"
  on public.clippings for insert
  with check (auth.uid() = user_id);

create policy "Users can remove their own clippings"
  on public.clippings for delete
  using (auth.uid() = user_id);
