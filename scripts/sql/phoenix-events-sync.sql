-- Trigger Edge Function: gateway JWT + vault CRON_SECRET (both required).
select net.http_post(
  url := 'https://zdqjeocdsbdzecawumdp.supabase.co/functions/v1/sync-events-catalog',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNzgzNTAsImV4cCI6MjA5ODg1NDM1MH0.TRk_okPkSXp17MUej4-XUY4oq0FIrX1cMlcoIsnk_zE',
    'x-cron-secret', (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'CRON_SECRET'
      limit 1
    )
  ),
  body := jsonb_build_object('mode', 'full', 'metroKey', 'phoenix-az'),
  timeout_milliseconds := 300000
) as phoenix_events_sync_request_id;
