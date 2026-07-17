-- Events catalog sync — full daily (3:00 UTC) + incremental every 4 hours.

select cron.schedule(
  'sync-events-catalog-daily-full',
  '0 3 * * *',
  $cron$
  select net.http_post(
    url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/sync-events-catalog',
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

select cron.schedule(
  'sync-events-catalog-incremental',
  '0 */4 * * *',
  $cron$
  select net.http_post(
    url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/sync-events-catalog',
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
