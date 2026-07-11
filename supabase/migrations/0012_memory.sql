-- Kindred — Memory Engine (Milestone 9)
-- Long-term reader continuity payload. No new newspaper sections.
-- Run after 0011_knowledge.sql.

alter table public.editions
  add column if not exists memory jsonb;

comment on column public.editions.memory is
  'MemoryPayload — followed stories, continuing news, interests, previous reading, since-you-last-read, timelines, saved discoveries, recurring events, reading continuity, knowledge continuity. Invisible until a surface ships. Never overrides editorial selection.';
