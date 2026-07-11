-- Kindred — Morning Edition AI (Milestone 10)
-- Calm multi-length briefings for audio / widgets / assistants.
-- No new newspaper sections. Run after 0012_memory.sql.

alter table public.editions
  add column if not exists morning_edition jsonb;

comment on column public.editions.morning_edition is
  'MorningEditionPayload — 20s / 60s / 3m editorial openings composed from Editorial, Personalization, Discovery, Knowledge, Memory, and Bandit. Powers future audio, widgets, notifications, Watch, Auto, CarPlay, voice. Invisible until a surface ships.';
