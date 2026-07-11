-- Kindred — Discovery Engine (Milestone 7)
-- Editorial recommendations payload. No new newspaper sections.
-- Run after 0009_bandit.sql.

alter table public.editions
  add column if not exists discovery jsonb;

comment on column public.editions.discovery is
  'DiscoveryPayload — Bandit''s Picks, Weekend Ideas, Hidden Gems, category desks. Invisible until a surface ships. Not a social feed.';
