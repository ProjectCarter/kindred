-- Kindred Hero Artwork library — public-domain artwork for the morning masthead.
-- Completely separate from kindred_image_library (editorial photography).

create table if not exists public.kindred_hero_artwork (
  id uuid primary key default gen_random_uuid(),
  internal_id text not null unique,
  artwork_title text not null,
  artist text not null,
  year text,
  source_institution text not null,
  source_url text not null,
  image_url text,
  hosted_url text,
  storage_path text,
  orientation text
    check (orientation in ('portrait', 'landscape', 'square')),
  dominant_colors text[] not null default '{}',
  tags text[] not null default '{}',
  seasons text[] not null default '{}',
  holidays text[] not null default '{}',
  license text not null,
  public_domain_status text not null default 'pending'
    check (public_domain_status in ('pending', 'verified', 'rejected')),
  attribution_text text,
  attribution_required boolean not null default true,
  verified_at timestamptz,
  verified_by text,
  verification_notes text,
  source_provider text not null,
  source_provider_artwork_id text not null,
  featured boolean not null default false,
  editorial_priority int not null default 50
    check (editorial_priority between 1 and 100),
  last_used_at timestamptz,
  use_count int not null default 0,
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (source_provider, source_provider_artwork_id)
);

create index if not exists kindred_hero_artwork_approved_idx
  on public.kindred_hero_artwork (approval_status, public_domain_status);

create index if not exists kindred_hero_artwork_season_idx
  on public.kindred_hero_artwork using gin (seasons);

create index if not exists kindred_hero_artwork_holiday_idx
  on public.kindred_hero_artwork using gin (holidays);

create index if not exists kindred_hero_artwork_featured_idx
  on public.kindred_hero_artwork (featured, editorial_priority desc);

create index if not exists kindred_hero_artwork_last_used_idx
  on public.kindred_hero_artwork (last_used_at nulls first);

-- Frozen daily hero selection — one artwork per edition date (server-side).
create table if not exists public.kindred_hero_artwork_edition_selections (
  id uuid primary key default gen_random_uuid(),
  edition_date date not null,
  artwork_id uuid not null references public.kindred_hero_artwork (id),
  selected_at timestamptz not null default now(),
  selection_context jsonb not null default '{}',
  unique (edition_date)
);

create index if not exists kindred_hero_artwork_edition_date_idx
  on public.kindred_hero_artwork_edition_selections (edition_date desc);

-- Dedicated storage for hosted hero artwork (never shared with editorial photos).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kindred-hero-artwork',
  'kindred-hero-artwork',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "kindred_hero_artwork_public_read"
  on storage.objects for select
  using (bucket_id = 'kindred-hero-artwork');

create policy "kindred_hero_artwork_service_write"
  on storage.objects for insert
  with check (bucket_id = 'kindred-hero-artwork');

create policy "kindred_hero_artwork_service_update"
  on storage.objects for update
  using (bucket_id = 'kindred-hero-artwork');
