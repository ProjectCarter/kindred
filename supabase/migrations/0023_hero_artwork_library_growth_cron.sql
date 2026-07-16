-- Hero Artwork Library — background growth cron (separate from edition build).
-- Requires pg_cron + pg_net (already enabled in 0015).
-- Replace YOUR-PROJECT-REF before applying in production.

select cron.schedule(
  'grow-hero-artwork-library-weekly',
  '0 4 * * 0',
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
    body := jsonb_build_object('targetNewCount', 8)
  );
  $cron$
);
