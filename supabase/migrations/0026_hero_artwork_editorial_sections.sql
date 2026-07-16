-- Structured Today's Masterpiece 2.0 editorial sections (stored at ingest).

alter table public.kindred_hero_artwork
  add column if not exists editorial_sections jsonb;
