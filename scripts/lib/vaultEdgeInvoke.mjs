/**
 * Invoke a Supabase Edge Function using vault CRON_SECRET (no local secret needed).
 */

import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const SUPABASE_PROJECT_URL =
  process.env.SUPABASE_URL ??
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  "https://zdqjeocdsbdzecawumdp.supabase.co";

const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNzgzNTAsImV4cCI6MjA5ODg1NDM1MH0.TRk_okPkSXp17MUej4-XUY4oq0FIrX1cMlcoIsnk_zE";

/**
 * @param {string} functionPath e.g. "process-user-edition-job"
 * @param {Record<string, unknown>} body
 * @param {{ timeoutMs?: number }} [opts]
 */
export function invokeEdgeViaVault(functionPath, body, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 600_000;
  const bodyJson = JSON.stringify(body).replace(/'/g, "''");

  const sql = `select net.http_post(
  url := '${SUPABASE_PROJECT_URL}/functions/v1/${functionPath}',
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
  timeout_milliseconds := ${timeoutMs}
) as request_id;`;

  const dir = join(tmpdir(), "kindred-vault-edge");
  mkdirSync(dir, { recursive: true });
  const sqlPath = join(dir, `invoke-${functionPath}-${Date.now()}.sql`);
  writeFileSync(sqlPath, sql);

  const result = spawnSync(
    "npx",
    ["supabase", "db", "query", "--linked", "-f", sqlPath],
    { stdio: "pipe", cwd: process.cwd(), encoding: "utf8" }
  );

  try {
    unlinkSync(sqlPath);
  } catch {
    // ignore
  }

  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}
