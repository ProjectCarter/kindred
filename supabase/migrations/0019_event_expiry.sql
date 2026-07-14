-- Kindred — Event auto-cleanup for Library & Clippings
-- Events naturally expire; Articles, Activities, and Recommendations never
-- do. Adds one column to know *when an event itself ends* (never the
-- clipping's saved date) so the client can quietly remove it 30 full
-- calendar days after that — see lib/edition/eventExpiry.ts.
-- Run after 0018_likes.sql.

alter table public.clippings
  add column if not exists event_ends_at timestamptz;

comment on column public.clippings.event_ends_at is
  'Resolved end timestamp for content_type = event, from the event''s own date/time — never the saved date. Null = Kindred could not confidently parse an end date, so this item is never auto-removed.';

-- Only ever queried for content_type = 'event' — a small partial index
-- keeps the sweep on My Clippings load cheap even as a library grows.
create index if not exists clippings_event_ends_at_idx
  on public.clippings (user_id, event_ends_at)
  where content_type = 'event';
