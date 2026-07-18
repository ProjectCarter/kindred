-- Staged edition builds: one Edge Function invocation per desk stage.

alter table public.generation_jobs
  add column if not exists build_stage text,
  add column if not exists stage_started_at timestamptz,
  add column if not exists completed_stages text[] not null default '{}',
  add column if not exists stage_diagnostics jsonb not null default '[]'::jsonb,
  add column if not exists edition_id uuid references public.editions (id) on delete set null,
  add column if not exists build_state jsonb not null default '{}'::jsonb;

comment on column public.generation_jobs.build_state is
  'Compact staging payload passed between build stages (released after finalize).';

comment on column public.generation_jobs.build_stage is
  'Current or next stage for resumable multi-invocation edition builds.';
comment on column public.generation_jobs.stage_started_at is
  'When the active build_stage began — used for stale-stage recovery.';
comment on column public.generation_jobs.completed_stages is
  'Stages that finished successfully for this job.';
comment on column public.generation_jobs.stage_diagnostics is
  'Structured per-stage timing and payload diagnostics.';
comment on column public.generation_jobs.edition_id is
  'Edition row being built across stages.';

create index if not exists generation_jobs_build_stage_status_idx
  on public.generation_jobs (status, build_stage, updated_at);

-- Claim on-demand job: increment attempts only when starting a fresh build.
create or replace function public.claim_user_generation_job(
  p_user_id uuid,
  p_edition_date date,
  p_metro_key text,
  p_max_attempts integer default 3
)
returns setof public.generation_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    update public.generation_jobs
    set status = 'processing',
        attempts = attempts + case
          when coalesce(array_length(completed_stages, 1), 0) = 0
            and build_stage is null
          then 1
          else 0
        end,
        stage_started_at = now(),
        updated_at = now()
    where user_id = p_user_id
      and edition_date = p_edition_date
      and metro_key is not distinct from p_metro_key
      and (
        status in ('pending', 'failed')
        or (
          status = 'processing'
          and coalesce(stage_started_at, updated_at)
            < now() - interval '10 minutes'
        )
      )
      and attempts < p_max_attempts
    returning *;
end;
$$;

-- Reap stale processing jobs; preserve completed_stages for safe resume.
create or replace function public.reap_stale_generation_jobs(
  p_stale_after_minutes integer default 10
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  reaped integer;
begin
  with stale as (
    update public.generation_jobs
    set status = 'pending',
        last_error = coalesce(last_error || ' ', '') || '[reaped: stuck in processing]',
        stage_started_at = null,
        updated_at = now()
    where status = 'processing'
      and coalesce(stage_started_at, updated_at)
        < now() - (p_stale_after_minutes || ' minutes')::interval
    returning id
  )
  select count(*)::integer into reaped from stale;
  return reaped;
end;
$$;

-- Mark a stage complete and queue the next stage (job returns to pending).
create or replace function public.complete_edition_build_stage(
  p_job_id uuid,
  p_completed_stage text,
  p_next_stage text,
  p_edition_id uuid default null,
  p_diagnostic jsonb default null
)
returns public.generation_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.generation_jobs;
begin
  update public.generation_jobs
  set completed_stages = case
        when p_completed_stage = any (completed_stages) then completed_stages
        else array_append(completed_stages, p_completed_stage)
      end,
      build_stage = p_next_stage,
      edition_id = coalesce(p_edition_id, edition_id),
      stage_diagnostics = case
        when p_diagnostic is null then stage_diagnostics
        else stage_diagnostics || jsonb_build_array(p_diagnostic)
      end,
      status = case when p_next_stage is null then 'ready' else 'pending' end,
      stage_started_at = null,
      last_error = null,
      updated_at = now()
  where id = p_job_id
  returning * into result;

  return result;
end;
$$;

revoke all on function public.complete_edition_build_stage(uuid, text, text, uuid, jsonb) from public;
grant execute on function public.complete_edition_build_stage(uuid, text, text, uuid, jsonb) to service_role;
