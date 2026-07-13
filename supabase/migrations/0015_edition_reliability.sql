-- Kindred — Background Generation Reliability (Phase 2: "The Presses Never Stop")
--
-- Fixes found in the background-generation audit:
--   1. No per-user timezone — overnight jobs used one UTC instant for every
--      user, which cannot be "before every user's morning" at once.
--   2. No atomic job claim — two overlapping sweeps (or a sweep overlapping
--      an on-demand build) could both pick up the same pending job.
--   3. No recovery for jobs stuck in `processing` after a crashed worker.
--   4. No committed cron trigger at all — process-edition-jobs previously
--      relied on someone clicking through the Supabase Dashboard, with no
--      record in this repo of whether that ever happened or is still active.
--
-- Run after 0014_local_places.sql.

-- 1) Per-user timezone (IANA name, e.g. "America/Phoenix"). Nullable —
-- populated opportunistically by the client (see lib/edition/timezone.ts);
-- process-edition-jobs falls back to DEFAULT_TIMEZONE in its own code until
-- a user's device has reported one.
alter table public.profiles
  add column if not exists timezone text;

-- 2) Editions status: no CHECK constraint existed at all before this
-- migration (any string was silently accepted). Add one now that
-- buildEdition.ts only ever writes 'processing' -> 'ready' | 'failed'.
do $$
begin
  alter table public.editions
    add constraint editions_status_check
    check (status in ('processing', 'ready', 'failed'));
exception
  when duplicate_object then null;
end $$;

-- 3) Atomic job claim. `FOR UPDATE SKIP LOCKED` means two overlapping
-- process-edition-jobs invocations (or a slow sweep still running when the
-- next one fires) can never both claim the same row — whichever gets there
-- first locks it, the other simply skips it and claims different rows.
-- Deliberately NOT scoped to a single edition_date: each job row already
-- carries the correct *per-user local* edition_date from enqueue time, so a
-- single global claim is simpler and correct across every timezone at once.
create or replace function public.claim_generation_jobs(
  p_max_attempts integer,
  p_batch_size integer
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
    where id in (
      select id
      from public.generation_jobs
      where status in ('pending', 'failed')
        and attempts < p_max_attempts
      order by created_at asc
      limit p_batch_size
      for update skip locked
    )
    returning *;
end;
$$;

revoke all on function public.claim_generation_jobs(integer, integer) from public;
grant execute on function public.claim_generation_jobs(integer, integer) to service_role;

-- 4) Stale-job reaper. A worker that dies mid-build (Edge Function timeout,
-- crash) leaves its job stuck at status='processing' forever today — no
-- code path ever revisits it. Reset anything stuck past a threshold back to
-- 'pending' so the next sweep retries it (still bounded by attempts, which
-- was already incremented when it was first claimed).
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
        updated_at = now()
    where status = 'processing'
      and updated_at < now() - (p_stale_after_minutes || ' minutes')::interval
    returning id
  )
  select count(*)::integer into reaped from stale;
  return reaped;
end;
$$;

revoke all on function public.reap_stale_generation_jobs(integer) from public;
grant execute on function public.reap_stale_generation_jobs(integer) to service_role;

-- 5) Cron trigger — committed as code instead of a Dashboard click nobody
-- can audit later. Requires pg_cron + pg_net (enable once, either here or
-- via Database > Extensions in the Dashboard):
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- The cron job below reads its bearer secret from Supabase Vault rather
-- than embedding it in this file — never commit the literal CRON_SECRET
-- value to git. One-time setup (run once in the SQL editor, NOT saved to a
-- migration file, so the real secret never lands in version control):
--
--   select vault.create_secret(
--     'your-long-random-secret',        -- must match `supabase secrets set CRON_SECRET=...`
--     'cron_secret_process_edition_jobs'
--   );
--
-- Then replace YOUR-PROJECT-REF below and run this migration.
--
-- Every 10 minutes is deliberate: process-edition-jobs now builds its
-- claimed batch concurrently (see supabase/functions/process-edition-jobs),
-- so one sweep finishes in roughly one edition's worth of time, not
-- batch_size × that — a 10-minute cadence gives every user's local
-- 2am-onward window several chances to be picked up the same night, and lets
-- failed jobs retry within the hour instead of waiting a full day.
select cron.schedule(
  'process-edition-jobs-sweep',
  '*/10 * * * *',
  $cron$
  select net.http_post(
    url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/process-edition-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'cron_secret_process_edition_jobs'
      )
    ),
    body := '{}'::jsonb
  );
  $cron$
);

-- Verify it's actually scheduled and running:
--   select * from cron.job where jobname = 'process-edition-jobs-sweep';
--   select * from cron.job_run_details
--     where jobid = (select jobid from cron.job where jobname = 'process-edition-jobs-sweep')
--     order by start_time desc limit 20;
