-- Kindred — Front Page Lead Story (structured metadata)
-- Invisible for now; selection engine stores one lead story per edition.

alter table public.editions
  add column if not exists lead_story jsonb;

comment on column public.editions.lead_story is
  'Front Page LeadStory object — headline, summary, hero image, Bandit Pick reservation. Not rendered in the newspaper UI yet.';
