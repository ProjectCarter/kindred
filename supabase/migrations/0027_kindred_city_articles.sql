-- Permanent "The Story of [City Name]" editorial articles — one verified feature per metro.
-- Generated once, stored permanently, copied into edition_sections at build time (no daily AI).

create table if not exists public.kindred_city_articles (
  id uuid primary key default gen_random_uuid(),
  metro_key text not null unique,
  city_name text not null,
  state text,
  region text,
  headline text not null,
  subtitle text not null,
  body text not null,
  image_url text not null,
  image_caption text not null,
  image_credit text not null,
  image_source_url text not null,
  image_license text not null default 'public_domain',
  sources jsonb not null default '[]',
  verification_notes text,
  word_count int not null default 0,
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kindred_city_articles_approved_idx
  on public.kindred_city_articles (approval_status, metro_key);

comment on table public.kindred_city_articles is
  'Permanent The Story of… editorial features — one article per metro, verified and cached.';

comment on column public.kindred_city_articles.metro_key is
  'Stable metro slug (e.g. seattle-wa, gilbert-az) — matches local_places_cache.metro_key.';

comment on column public.kindred_city_articles.subtitle is
  'One-sentence editorial subtitle beneath "The Story of [City Name]".';

alter table public.kindred_city_articles enable row level security;

create policy "Authenticated users read approved city articles"
  on public.kindred_city_articles for select
  to authenticated
  using (approval_status = 'approved');
