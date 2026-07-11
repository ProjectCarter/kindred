-- Kindred — Knowledge Engine (Milestone 8)
-- Trustworthy context packets for articles. No new newspaper sections.
-- Run after 0010_discovery.sql.

alter table public.editions
  add column if not exists knowledge jsonb;

comment on column public.editions.knowledge is
  'KnowledgePayload — related stories, history, timelines, maps, definitions, explainers, previous coverage, local context, why this matters. Attached by story id. Invisible until a reader surface ships.';
