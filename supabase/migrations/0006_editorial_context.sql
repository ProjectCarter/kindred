-- Kindred — Editorial intelligence (invisible metadata)
-- Structured editor notes for each edition. Not shown in the UI yet.

alter table public.editions
  add column if not exists editorial_context jsonb;

comment on column public.editions.editorial_context is
  'Structured EditionEditorialContext — why each section exists. For future AI (Bandit, Weekly Picks, why-this-story). Not rendered in the newspaper UI.';
