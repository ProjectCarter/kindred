-- Kindred — The First Edition
-- Run this in the same Supabase project's SQL Editor, after 0001 and 0002.

create table if not exists public.editions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  edition_date date not null default current_date,
  status text not null default 'ready',
  created_at timestamptz not null default now(),
  unique (user_id, edition_date)
);

alter table public.editions enable row level security;

create policy "Users can view their own editions"
  on public.editions for select
  using (auth.uid() = user_id);

-- Editions are written by the Edge Function using the service role key,
-- which bypasses RLS by design — no insert policy is needed for regular users.

create table if not exists public.edition_sections (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions(id) on delete cascade,
  section_type text not null,
  position integer not null,
  headline text not null,
  body text not null,
  source_note text,
  created_at timestamptz not null default now()
);

alter table public.edition_sections enable row level security;

create policy "Users can view sections of their own editions"
  on public.edition_sections for select
  using (
    exists (
      select 1 from public.editions
      where editions.id = edition_sections.edition_id
      and editions.user_id = auth.uid()
    )
  );
