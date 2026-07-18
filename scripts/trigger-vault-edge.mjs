#!/usr/bin/env node
/**
 * Trigger catalog Edge Functions via Supabase vault CRON_SECRET — no local CRON needed.
 *
 * Usage:
 *   node scripts/trigger-vault-edge.mjs sync-events phoenix-az
 *   node scripts/trigger-vault-edge.mjs sync-activities phoenix-az
 *   node scripts/trigger-vault-edge.mjs sync-food-drink phoenix-az
 */

import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const SUPABASE_PROJECT_URL = "https://zdqjeocdsbdzecawumdp.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNzgzNTAsImV4cCI6MjA5ODg1NDM1MH0.TRk_okPkSXp17MUej4-XUY4oq0FIrX1cMlcoIsnk_zE";

const HANDLERS = {
  "sync-events": {
    path: "sync-events-catalog",
    body: (metroKey) => ({ mode: "full", metroKey }),
  },
  "sync-activities": {
    path: "sync-activities-catalog",
    body: (metroKey) => ({ mode: "full", metroKey }),
  },
  "sync-food-drink": {
    path: "sync-food-drink-catalog",
    body: (metroKey) => ({ mode: "full", metroKey }),
  },
};

const action = process.argv[2]?.trim();
const metroKey = process.argv[3]?.trim();

if (!action || !metroKey || !HANDLERS[action]) {
  console.error(
    "Usage: node scripts/trigger-vault-edge.mjs <sync-events|sync-activities|sync-food-drink> <metro-key>"
  );
  process.exit(1);
}

const handler = HANDLERS[action];
const bodyJson = JSON.stringify(handler.body(metroKey)).replace(/'/g, "''");

const sql = `select net.http_post(
  url := '${SUPABASE_PROJECT_URL}/functions/v1/${handler.path}',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ${SUPABASE_ANON_KEY}',
    'x-cron-secret', (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'CRON_SECRET'
      limit 1
    )
  ),
  body := '${bodyJson}'::jsonb,
  timeout_milliseconds := 300000
) as request_id;`;

const dir = join(process.cwd(), "scripts", "sql", ".tmp");
mkdirSync(dir, { recursive: true });
const sqlPath = join(dir, `${action}-${metroKey}.sql`);
writeFileSync(sqlPath, sql);

const result = spawnSync("npx", ["supabase", "db", "query", "--linked", "-f", sqlPath], {
  stdio: "inherit",
  cwd: process.cwd(),
});

process.exit(result.status ?? 1);
