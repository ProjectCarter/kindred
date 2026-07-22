-- Edition Pipeline V2 — targeted stage requeue foundation (Phase 2).
-- Does not auto-invoke from Phase 1 validation.

create or replace function public.requeue_edition_build_stages(
  p_job_id uuid,
  p_stages text[]
)
returns public.generation_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.generation_jobs;
  job public.generation_jobs;
  stage text;
  first_stage text;
  cleaned text[] := '{}';
  allowed text[] := array[
    'generate_national_daily',
    'attach_national_daily',
    'weather',
    'local_events',
    'activities',
    'food_drinks',
    'story_of',
    'local_news',
    'bandits_pick',
    'validate_technical',
    'publish_edition'
  ];
begin
  if p_stages is null or coalesce(array_length(p_stages, 1), 0) = 0 then
    raise exception 'requeue_edition_build_stages: p_stages required';
  end if;

  select * into job from public.generation_jobs where id = p_job_id;
  if job.id is null then
    raise exception 'requeue_edition_build_stages: job not found';
  end if;

  foreach stage in array p_stages loop
    if stage = 'initialize_edition' then
      raise exception 'requeue_edition_build_stages: initialize_edition not allowed';
    end if;
    if not (stage = any (allowed)) then
      raise exception 'requeue_edition_build_stages: unknown stage %', stage;
    end if;
    if not (stage = any (cleaned)) then
      cleaned := array_append(cleaned, stage);
    end if;
  end loop;

  first_stage := cleaned[1];

  update public.generation_jobs
  set completed_stages = array(
        select s
        from unnest(coalesce(completed_stages, '{}')) as s
        where not (s = any (cleaned))
      ),
      build_stage = first_stage,
      status = 'pending',
      stage_started_at = null,
      last_error = null,
      updated_at = now()
  where id = p_job_id
  returning * into result;

  return result;
end;
$$;

comment on function public.requeue_edition_build_stages(uuid, text[]) is
  'Phase 2 targeted repair: remove listed stages from completed_stages and resume at first listed stage. Preserves validation history in build_state. Never resets initialize_edition.';

revoke all on function public.requeue_edition_build_stages(uuid, text[]) from public;
grant execute on function public.requeue_edition_build_stages(uuid, text[]) to service_role;
