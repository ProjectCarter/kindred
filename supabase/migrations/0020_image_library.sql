-- Kindred curated image library — royalty-free photos ingested from Pexels/Pixabay
-- and stored in Kindred-controlled storage. Never hotlink Pixabay permanently.

create table if not exists public.kindred_image_library (
  id uuid primary key default gen_random_uuid(),
  internal_id text not null unique,
  hosted_url text not null,
  storage_path text not null,
  thumbnail_url text,
  original_source text not null,
  original_source_image_id text not null,
  photographer_name text,
  source_page_url text,
  attribution_text text,
  primary_category text not null,
  secondary_tags text[] not null default '{}',
  environment_tags text[] not null default '{}',
  orientation text
    check (orientation in ('portrait', 'landscape', 'square')),
  dominant_subject text,
  composition_tag text,
  dominant_color text,
  content_hash text,
  width int,
  height int,
  byte_size int,
  quality_score int not null default 50
    check (quality_score between 1 and 100),
  quality_signals jsonb not null default '{}',
  approval_status text not null default 'approved'
    check (approval_status in ('pending', 'approved', 'rejected')),
  last_used_at timestamptz,
  recent_use_count int not null default 0,
  skip_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (original_source, original_source_image_id)
);

create index if not exists kindred_image_library_category_idx
  on public.kindred_image_library (primary_category, approval_status);

create index if not exists kindred_image_library_tags_idx
  on public.kindred_image_library using gin (secondary_tags);

create index if not exists kindred_image_library_quality_idx
  on public.kindred_image_library (primary_category, approval_status, quality_score desc);

create index if not exists kindred_image_library_composition_idx
  on public.kindred_image_library (primary_category, composition_tag);

create index if not exists kindred_image_library_last_used_idx
  on public.kindred_image_library (last_used_at nulls first);

-- Pixabay requires caching search results; Pexels benefits from the same pattern.
create table if not exists public.kindred_image_search_cache (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  query_hash text not null,
  query_text text not null,
  results_json jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (provider, query_hash)
);

create index if not exists kindred_image_search_cache_expires_idx
  on public.kindred_image_search_cache (expires_at);

-- Public read bucket for hosted editorial photography.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kindred-images',
  'kindred-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Service role writes; public reads approved assets.
create policy "kindred_images_public_read"
  on storage.objects for select
  using (bucket_id = 'kindred-images');

create policy "kindred_images_service_write"
  on storage.objects for insert
  with check (bucket_id = 'kindred-images');

create policy "kindred_images_service_update"
  on storage.objects for update
  using (bucket_id = 'kindred-images');
