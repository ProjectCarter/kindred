-- Kindred — Unified Saved & Clippings (Milestone: Saved & Clippings v2)
-- Extends the existing `clippings` table so Local Events, Activities, and
-- Recommendations can be saved alongside Articles — as a self-contained
-- "snapshot" (like a real newspaper clipping), since those items are
-- ephemeral discovery data with no durable row of their own to reference.
-- Run after 0005_clippings.sql. No existing rows to migrate (table is empty).

-- The previous uniqueness rule only understood article-shaped clippings
-- (one edition_sections row per save). Replaced by `clip_key`, which is
-- unique across every content type.
alter table public.clippings
  drop constraint if exists clippings_user_id_section_id_key;

-- Only "article" clippings reference a real edition_sections row.
alter table public.clippings
  alter column section_id drop not null;

alter table public.clippings
  add column if not exists content_type text not null default 'article',
  add column if not exists clip_key text,
  add column if not exists summary text,
  add column if not exists image_url text,
  add column if not exists location text,
  add column if not exists event_time text,
  add column if not exists payload jsonb;

alter table public.clippings
  drop constraint if exists clippings_content_type_check;
alter table public.clippings
  add constraint clippings_content_type_check
    check (content_type in ('article', 'event', 'activity', 'recommendation'));

-- Backfill safety net (table is empty today, but keeps this migration
-- replayable against a future non-empty environment).
update public.clippings
  set clip_key = 'article:' || section_id::text
  where clip_key is null and section_id is not null;

alter table public.clippings
  alter column clip_key set not null;

alter table public.clippings
  drop constraint if exists clippings_user_id_clip_key_key;
alter table public.clippings
  add constraint clippings_user_id_clip_key_key unique (user_id, clip_key);

create index if not exists clippings_user_id_content_type_idx
  on public.clippings (user_id, content_type);
