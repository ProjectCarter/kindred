-- On-demand async edition builds: claim one user's job atomically.

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
        attempts = attempts + 1,
        updated_at = now()
    where user_id = p_user_id
      and edition_date = p_edition_date
      and metro_key is not distinct from p_metro_key
      and status in ('pending', 'failed')
      and attempts < p_max_attempts
    returning *;
end;
$$;

revoke all on function public.claim_user_generation_job(uuid, date, text, integer) from public;
grant execute on function public.claim_user_generation_job(uuid, date, text, integer) to service_role;
