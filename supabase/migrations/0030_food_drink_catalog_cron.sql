-- Daily incremental Food & Drink catalog sync (3:15 AM UTC).
-- Weekly full reconciliation runs separately (0031).
select cron.schedule(
  'sync-food-drink-catalog-daily',
  '15 3 * * *',
  $cron$
  select net.http_post(
    url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/sync-food-drink-catalog',
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
