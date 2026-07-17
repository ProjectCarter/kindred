-- Enable daily masterpiece library growth (~2 approved artworks).
select cron.unschedule(jobid)
from cron.job
where jobname in (
  'grow-hero-artwork-library-weekly',
  'grow-hero-artwork-library-daily'
);

select cron.schedule(
  'grow-hero-artwork-library-daily',
  '0 3 * * *',
  $cron$
  select net.http_post(
    url := 'https://zdqjeocdsbdzecawumdp.supabase.co/functions/v1/grow-hero-artwork-library',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'CRON_SECRET'
      )
    ),
    body := jsonb_build_object('targetNewCount', 2)
  );
  $cron$
);
