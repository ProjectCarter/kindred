-- Hero Artwork evolution — collections, editorial copy, strengthened licensing.
-- Separate from kindred_image_library (editorial photography).

alter table public.kindred_hero_artwork
  add column if not exists collections text[] not null default '{}',
  add column if not exists mood_tags text[] not null default '{}',
  add column if not exists about_artwork_body text,
  add column if not exists about_word_count int,
  add column if not exists license_url text,
  add column if not exists verification_source text,
  add column if not exists commercial_use_confirmed boolean not null default false,
  add column if not exists curator_editorial_status text not null default 'pending'
    check (curator_editorial_status in ('pending', 'approved', 'rejected'));

create index if not exists kindred_hero_artwork_collections_idx
  on public.kindred_hero_artwork using gin (collections);

create index if not exists kindred_hero_artwork_mood_idx
  on public.kindred_hero_artwork using gin (mood_tags);

-- Editorial collection registry — expandable without redesigning selection logic.
create table if not exists public.kindred_hero_artwork_collections (
  id text primary key,
  title text not null,
  description text not null default '',
  parent_collection_id text references public.kindred_hero_artwork_collections (id),
  seasonal_affinity text[] not null default '{}',
  holiday_affinity text[] not null default '{}',
  provider_affinity text[] not null default '{}',
  editorial_priority int not null default 50
    check (editorial_priority between 1 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists kindred_hero_artwork_collections_active_idx
  on public.kindred_hero_artwork_collections (active, editorial_priority desc);

-- Freeze full morning presentation — artwork + editorial copy + Bandit note.
alter table public.kindred_hero_artwork_edition_selections
  add column if not exists bandit_morning_note text,
  add column if not exists presentation_snapshot jsonb not null default '{}';
