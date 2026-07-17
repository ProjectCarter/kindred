-- Kindred Venue Editorial Score — recommendation strength separate from verification.
alter table public.food_drink_catalog
  add column if not exists editorial_score smallint not null default 0
    check (editorial_score >= 0 and editorial_score <= 100),
  add column if not exists editorial_labels jsonb not null default '[]'::jsonb,
  add column if not exists editorial_reason text,
  add column if not exists editorial_score_version smallint not null default 0,
  add column if not exists editorial_scored_at timestamptz,
  add column if not exists editorial_score_evidence jsonb not null default '{}'::jsonb,
  add column if not exists editorial_score_previous smallint,
  add column if not exists editorial_score_change_reason text,
  add column if not exists editorial_score_material_fingerprint text,
  add column if not exists editorial_lock boolean not null default false,
  add column if not exists editorial_score_override smallint
    check (editorial_score_override is null or (editorial_score_override >= 0 and editorial_score_override <= 100)),
  add column if not exists editorial_labels_override jsonb,
  add column if not exists editorial_reason_override text,
  add column if not exists override_author text,
  add column if not exists override_timestamp timestamptz,
  add column if not exists editorial_override_history jsonb not null default '[]'::jsonb;

comment on column public.food_drink_catalog.editorial_score is
  'Kindred Editorial Score (0–100) — recommendation strength, not provider rating or verification confidence.';
comment on column public.food_drink_catalog.editorial_labels is
  'Structured editorial labels (editors_pick, hidden_gem, etc.) — evidence-backed only.';
comment on column public.food_drink_catalog.editorial_reason is
  'Internal editorial reason for score — not shown to readers unless rewritten.';
comment on column public.food_drink_catalog.editorial_lock is
  'When true, automated imports may update facts but not score, labels, or reason.';

create index if not exists food_drink_catalog_metro_editorial_score_idx
  on public.food_drink_catalog (metro_key, editorial_score desc)
  where lifecycle in ('verified', 'featured', 'evergreen');
