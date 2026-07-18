-- Fix checkpoint upsert: replace expression index with a real unique constraint.
-- Safe additive migration — normalizes null checkpoints to empty string.

update public.kindred_market_build_checkpoints
set checkpoint = ''
where checkpoint is null;

alter table public.kindred_market_build_checkpoints
  alter column checkpoint set default '',
  alter column checkpoint set not null;

drop index if exists public.kindred_market_build_checkpoints_run_phase_uq;

alter table public.kindred_market_build_checkpoints
  drop constraint if exists kindred_market_build_checkpoints_run_phase_checkpoint_uq;

alter table public.kindred_market_build_checkpoints
  add constraint kindred_market_build_checkpoints_run_phase_checkpoint_uq
  unique (run_id, phase, checkpoint);
