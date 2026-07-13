# Kindred — Overnight-First Architecture: Live Refresh

Requirement 3 of "make overnight generation primary": after a ready edition
opens, refresh only the structured, factual data that legitimately changes
during the day (event times, cancellations, ticket links, which cached
places currently qualify) — without regenerating the printed paper. The
paper itself (Lead, Top Stories, Bandit's Pick, the opening, recommendation
copy) is still written once by the overnight job and never rewritten here,
same as a real newspaper doesn't rewrite its own front page at 2pm.

Requirements 1, 2, 5, and 6 ("check for today's edition first, open it
instantly with no AI call, fall back to live generation only when nothing
exists, overnight as the normal path") were already true of the existing
Phase 2 architecture — nothing needed to change there. This round only adds
the piece that didn't exist yet: the live refresh itself.

## What changed

- `supabase/functions/_shared/liveRefresh.ts` (new) — the shared refresh
  logic. Re-fetches events and re-runs the deterministic Discovery selection
  over the existing places cache; patches only the `local_events`
  `edition_sections` row and the `editions.discovery` column. Zero Anthropic
  calls. Reuses the exact same fetch/selection functions
  `buildEdition.ts` already calls — no duplicated logic.
- `supabase/functions/refresh-live-data/index.ts` (new) — per-user,
  client-triggered endpoint. Same auth pattern as the existing
  `refresh-discovery` / `refresh-local-event-images` functions (which this
  supersedes for this purpose, though they're left in place, untouched).
- `supabase/functions/sweep-live-refresh/index.ts` (new) — cron-triggered
  batch sweep, same `CRON_SECRET` auth pattern as `process-edition-jobs`, so
  live data stays fresh even if nobody reopens the app for hours. Skips any
  edition refreshed in the last 20 minutes.
- `supabase/migrations/0016_live_refresh.sql` (new) — adds
  `editions.live_refreshed_at` and schedules the `sweep-live-refresh` cron
  job (every 20 minutes), reusing the same `CRON_SECRET` Vault secret from
  Phase 2 — no new secret needed.
- `lib/edition/liveRefresh.ts` + `app/home.tsx` — after `loadEdition()`
  renders an already-ready edition, fires `refresh-live-data` silently
  (fire-and-forget, no loading state, no error surfaced on failure),
  throttled to at most once every 15 minutes per edition. If it reports a
  change, quietly re-runs the same fast DB-only `loadEdition()` call to pick
  it up — no scroll reset, no spinner.

## Setup — three steps

### 1. Apply the migration

Open `supabase/migrations/0016_live_refresh.sql`, replace
`YOUR-PROJECT-REF` in the `cron.schedule(...)` call with your project ref
(same one used in `0015_edition_reliability.sql`), then run it in the SQL
editor or via `supabase db push`.

No new Vault secret needed — this reuses the `CRON_SECRET` already created
for Phase 2.

### 2. Deploy the two new Edge Functions

```
supabase functions deploy refresh-live-data
supabase functions deploy sweep-live-refresh
```

(Nothing else changed this round — no redeploy needed for `generate-edition`
or `process-edition-jobs`.)

### 3. Ship the client change

Whatever your normal release process is for `app/home.tsx` and
`lib/edition/liveRefresh.ts` (this is a plain app-code change, not an Edge
Function).

## Verifying it's actually running

```sql
-- Confirm the schedule exists and is active
select * from cron.job where jobname = 'sweep-live-refresh';

-- Last 20 runs
select * from cron.job_run_details
  where jobid = (select jobid from cron.job where jobname = 'sweep-live-refresh')
  order by start_time desc
  limit 20;

-- Spot-check a specific edition
select id, edition_date, status, live_refreshed_at
from editions
where user_id = '<their user id>'
order by edition_date desc
limit 1;
```

Each sweep's response body reports what it did:

```json
{
  "success": true,
  "candidates": 12,
  "processed": 12,
  "succeeded": 12,
  "failed": 0,
  "changed": 2
}
```

`changed` is how many editions actually had different events or discovery
data since their last refresh — usually low, which is expected (most
20-minute windows won't see an event get cancelled).

## Deliberately out of scope this round

- The AI-written weather sentence is never regenerated — by design, per your
  call. Live refresh only ever touches structured data.
- Recommendation *copy* (the "why visit this" text) stays print-once. Only
  which cached places currently qualify for selection is re-evaluated.
- `refresh-discovery` and `refresh-local-event-images` (the two narrower
  functions this generalizes) are left deployed and untouched in case
  anything else calls them directly — nothing in this repo does anymore.
