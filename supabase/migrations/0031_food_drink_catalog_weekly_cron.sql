-- Weekly full Food & Drink catalog reconciliation (Sunday 4:30 AM UTC).
select cron.schedule(
  'sync-food-drink-catalog-weekly',
  '30 4 * * 0',
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
    body := '{"mode":"full"}'::jsonb
  );
  $cron$
);
