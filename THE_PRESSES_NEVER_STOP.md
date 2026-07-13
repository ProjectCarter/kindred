# Kindred — Phase 2: The Presses Never Stop

Makes today's edition exist *before* the reader opens Kindred, per-user
timezone, with real retry/locking — instead of relying on a Dashboard cron
click nobody could verify and one shared UTC "today" for every user.

See the audit that motivated this (in chat) for the full list of bugs this
closes: no committed cron trigger, UTC vs. device-local date mismatch, a
10-job batch ceiling that silently dropped anyone past it, no atomic job
claim (double-build risk), no stale-`processing` recovery, and editions
that could be marked `ready` before their sections existed.

## What changed

- `supabase/migrations/0015_edition_reliability.sql` — `profiles.timezone`
  column, an `editions.status` CHECK constraint, two Postgres functions
  (`claim_generation_jobs`, `reap_stale_generation_jobs`), and a `pg_cron` +
  `pg_net` schedule that POSTs to `process-edition-jobs` every 10 minutes.
- `supabase/functions/process-edition-jobs/index.ts` — enqueues per-user by
  *their* local date/hour (not one UTC instant), reaps stuck jobs first,
  claims its batch atomically (no more double-build races), and builds the
  whole claimed batch concurrently instead of one-by-one in a loop.
- `supabase/functions/_shared/buildEdition.ts` — `editions.status` now goes
  `processing` → `ready` only after `edition_sections` is confirmed
  written, so a crash mid-build can never leave a fake-`ready` edition with
  no content (which previously could never be regenerated).
- `lib/edition/timezone.ts` + `app/home.tsx` — the client now reports its
  IANA timezone to `profiles.timezone` on load, and reads today's
  `generation_jobs` row so an in-progress overnight build shows a calm "on
  the press" state (with light polling) instead of the manual "Open
  today's paper" button. That manual button is still there — it just only
  appears when there's no background job already running.

## Setup — required before this does anything in production

I could write all of the above, but I don't have a database connection or
service-role key in this environment, so none of it has been run against
your Supabase project yet. Three steps:

### 1. Store the cron secret in Supabase Vault (do this in the SQL editor — never commit it)

```sql
select vault.create_secret(
  'your-long-random-secret',        -- must match: supabase secrets set CRON_SECRET=...
  'cron_secret_process_edition_jobs'
);
```

If you haven't set `CRON_SECRET` as an Edge Function secret yet:

```
supabase secrets set CRON_SECRET=your-long-random-secret
```

### 2. Apply the migration

Open `supabase/migrations/0015_edition_reliability.sql`, replace
`YOUR-PROJECT-REF` in the `cron.schedule(...)` call with your actual
project ref, then run it via the SQL editor or `supabase db push`.

If `pg_cron` / `pg_net` aren't enabled yet, either the `create extension`
lines in the migration will handle it, or enable them first under
**Database → Extensions**.

### 3. Redeploy the Edge Function

```
supabase functions deploy process-edition-jobs
```

(`generate-edition` didn't change this round — no redeploy needed there.)

## Verifying it's actually running

```sql
-- Confirm the schedule exists and is active
select * from cron.job where jobname = 'process-edition-jobs-sweep';

-- Last 20 runs — look for status = 'succeeded' and check the timing
select * from cron.job_run_details
  where jobid = (select jobid from cron.job where jobname = 'process-edition-jobs-sweep')
  order by start_time desc
  limit 20;
```

Each successful invocation's response body also reports what it did —
worth spot-checking once after deploying:

```json
{
  "success": true,
  "reaped": 0,
  "localDatesInPlay": ["2026-07-13", "2026-07-14"],
  "enqueued": 3,
  "skippedTooEarly": 41,
  "processed": 15,
  "succeeded": 14,
  "failed": 1
}
```

To confirm tomorrow's paper is ready before you open the app: pick a real
user, and after their local 2am has passed, run

```sql
select id, edition_date, status,
       (select count(*) from edition_sections where edition_sections.edition_id = editions.id) as section_count
from editions
where user_id = '<their user id>'
order by edition_date desc
limit 1;
```

`status = 'ready'` with `section_count > 0` means it's genuinely done — not
just marked done.

## Known follow-ups (deliberately out of scope this round)

- Users who haven't opened the app since this shipped won't have
  `profiles.timezone` set yet — `process-edition-jobs` falls back to
  `America/Phoenix` for them until their device reports in. Self-heals the
  first time they load Home.
- Push notifications ("Good morning, your edition is ready") are still
  deferred, as before — the client-side polling in this round covers "the
  app already knows," not "tell me even when it's closed."
- The enqueue step still does one profile at a time (existing-edition
  check + upsert) rather than a bulk query — fine at today's scale, worth
  revisiting if the user base grows large enough to make a 10-minute sweep
  too slow to get through everyone.
