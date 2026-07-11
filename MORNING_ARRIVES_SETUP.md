# Kindred — The Morning Arrives (Milestone 3)

Overnight edition generation via a queue table and a cron-triggered Edge
Function. Manual "Build today's edition" remains as a calm fallback.

Push notifications are intentionally deferred (they need device tokens and
`expo-notifications`) — editions still appear in the app after the overnight
job runs.

## New setup steps

### 1. Run the new database migration

In the Supabase SQL Editor, paste and run
`supabase/migrations/0004_generation_jobs.sql`.

### 2. Set the cron secret

Pick a long random string and store it as an Edge Function secret (never in
the app):

```
supabase secrets set CRON_SECRET=your-long-random-secret
```

`NEWS_API_KEY` and `ANTHROPIC_API_KEY` should already be set from
[EDITION_SETUP.md](./EDITION_SETUP.md).

### 3. Redeploy Edge Functions

```
supabase functions deploy generate-edition
supabase functions deploy process-edition-jobs
```

### 4. Schedule the overnight run

In the Supabase Dashboard, create a scheduled trigger (or use `pg_cron` +
`net.http_post`) that **POSTs** once each morning to:

`https://YOUR-PROJECT-REF.supabase.co/functions/v1/process-edition-jobs`

with either header:

- `x-cron-secret: your-long-random-secret`, or
- `Authorization: Bearer your-long-random-secret`

Suggested schedule: daily around 5:00–6:00 in your users' primary timezone.
Each invocation enqueues missing jobs, then processes up to 10. If you have
more users than that, run it a few times or tighten the schedule.

### 5. Manual smoke test (no app login required)

```
curl -X POST \
  "https://YOUR-PROJECT-REF.supabase.co/functions/v1/process-edition-jobs" \
  -H "x-cron-secret: your-long-random-secret"
```

You should get JSON like `{ "success": true, "enqueued": …, "processed": … }`.
Users who already completed onboarding (interests saved) get a job; after a
successful run, opening Home shows today's edition.

## What this milestone does not include

- Native push ("Good morning, your edition is ready") — next follow-up once
  overnight generation is proven.
- Per-user timezone / location preferences — overnight jobs use a shared
  default location until that exists.
