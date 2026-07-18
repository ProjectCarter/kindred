#!/usr/bin/env node
/**
 * Invoke build-market phase via vault CRON + anon JWT (no local CRON_SECRET).
 *
 * Usage:
 *   node scripts/trigger-vault-build-market.mjs phoenix-az-metro activities
 *   node scripts/trigger-vault-build-market.mjs phoenix-az-metro food_drinks
 *   node scripts/trigger-vault-build-market.mjs phoenix-az-metro validate
 */

import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const SUPABASE_PROJECT_URL = "https://zdqjeocdsbdzecawumdp.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNzgzNTAsImV4cCI6MjA5ODg1NDM1MH0.TRk_okPkSXp17MUej4-XUY4oq0FIrX1cMlcoIsnk_zE";

const slug = process.argv[2]?.trim();
const phaseOrAction = process.argv[3]?.trim();

if (!slug || !phaseOrAction) {
  console.error(
    "Usage: node scripts/trigger-vault-build-market.mjs <market-slug> <phase|validate|finalize>"
  );
  process.exit(1);
}

const action = phaseOrAction === "validate" || phaseOrAction === "finalize" ? phaseOrAction : "phase";
const runId = randomUUID();

const body =
  action === "phase"
    ? {
        slug,
        action: "phase",
        phase: phaseOrAction,
        runId,
        attempt: 1,
      }
    : { slug, action: phaseOrAction };

const bodyJson = JSON.stringify(body).replace(/'/g, "''");

const sql = `-- Vault-triggered build-market (${slug} / ${phaseOrAction})
select net.http_post(
  url := '${SUPABASE_PROJECT_URL}/functions/v1/build-market',
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
) as build_market_request_id;`;

const dir = join(process.cwd(), "scripts", "sql", ".tmp");
mkdirSync(dir, { recursive: true });
const sqlPath = join(dir, `build-market-${slug}-${phaseOrAction}.sql`);
writeFileSync(sqlPath, sql);

console.log(`Triggering build-market ${action}${action === "phase" ? `:${phaseOrAction}` : ""} for ${slug} (runId=${runId})`);

const result = spawnSync("npx", ["supabase", "db", "query", "--linked", "-f", sqlPath], {
  stdio: "inherit",
  cwd: process.cwd(),
});

process.exit(result.status ?? 1);
