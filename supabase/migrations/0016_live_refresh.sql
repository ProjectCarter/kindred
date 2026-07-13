-- Kindred — Live Refresh (overnight-first architecture, requirement 3)
--
-- The paper itself (Lead, Top Stories, Bandit's Pick, the opening,
-- recommendation copy) is printed once by buildEdition.ts and never rewritten
-- here. This migration only supports the structured, factual layer that
-- legitimately changes during the day: event times/cancellations/ticket
-- links, and which cached places currently qualify as recommendable. See
-- supabase/functions/_shared/liveRefresh.ts for exactly what gets touched.
--
-- Run after 0015_edition_reliability.sql.

-- 1) Track when an edition's live metadata was last refreshed, so both the
-- client-triggered call and the cron sweep below can skip editions that
-- were just refreshed a few minutes ago instead of re-hitting SerpAPI /
-- Foursquare on every single app open.
alter table public.editions
  add column if not exists live_refreshed_at timestamptz;

-- 2) Cron trigger for sweep-live-refresh — same committed-as-code pattern as
-- process-edition-jobs-sweep in 0015. Reuses the same CRON_SECRET Vault
-- secret; no new secret to create.
--
-- One-time setup already done for the 0015 migration (skip if CRON_SECRET
-- already exists in both Vault and Edge Function secrets). Replace
-- YOUR-PROJECT-REF below and run this migration.
--
-- Every 20 minutes: this sweep only touches structured data (no Anthropic
-- calls), so it's cheap — but there's no reason to run it more often than
-- readers would ever notice event/recommendation changes mid-day.
select cron.schedule(
  'sweep-live-refresh',
  '*/20 * * * *',
  $cron$
  select net.http_post(
    url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/sweep-live-refresh',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'CRON_SECRET'
      )
    ),
    body := '{}'::jsonb
  );
  $cron$
);

-- Verify it's actually scheduled and running:
--   select * from cron.job where jobname = 'sweep-live-refresh';
--   select * from cron.job_run_details
--     where jobid = (select jobid from cron.job where jobname = 'sweep-live-refresh')
--     order by start_time desc limit 20;
