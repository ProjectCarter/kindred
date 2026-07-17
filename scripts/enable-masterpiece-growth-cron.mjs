/**
 * Enable daily masterpiece library growth cron (~2 artworks/day at 03:00 UTC).
 * Run only after initial library QA is approved.
 *
 * Usage:
 *   SUPABASE_DB_PASSWORD=... node scripts/enable-masterpiece-growth-cron.mjs
 *   npx supabase db query --linked -f scripts/enable-masterpiece-growth-cron.sql
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SQL = `-- Enable daily masterpiece library growth (~2 approved artworks).
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
`;

fs.writeFileSync(path.join(__dirname, "enable-masterpiece-growth-cron.sql"), SQL);

console.log(`Wrote scripts/enable-masterpiece-growth-cron.sql
Apply with:
  npx supabase db query --linked -f scripts/enable-masterpiece-growth-cron.sql
`);
