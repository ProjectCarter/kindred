-- Allow staged builds to resume after prior attempt exhaustion when stages were persisted.

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
      and (
        attempts < p_max_attempts
        or coalesce(array_length(completed_stages, 1), 0) > 0
      )
    returning *;
end;
$$;
