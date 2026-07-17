-- Activities catalog sync — daily incremental (3:30 UTC) + weekly full (Sunday 5:00 UTC).

select cron.schedule(
  'sync-activities-catalog-daily',
  '30 3 * * *',
  $cron$
  select net.http_post(
    url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/sync-activities-catalog',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'CRON_SECRET'
      )
    ),
    body := '{"mode":"incremental"}'::jsonb
  );
  $cron$
);

select cron.schedule(
  'sync-activities-catalog-weekly-full',
  '0 5 * * 0',
  $cron$
  select net.http_post(
    url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/sync-activities-catalog',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'CRON_SECRET'
      )
    ),
    body := '{"mode":"full"}'::jsonb
  );
  $cron$
);
