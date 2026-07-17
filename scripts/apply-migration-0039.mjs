/**
 * Apply migration 0039 (schema + backfill). Cron scheduling is skipped —
 * enable later via scripts/enable-masterpiece-growth-cron.mjs after QA.
 *
 * Requires one of:
 *   SUPABASE_DB_URL=postgresql://...
 *   SUPABASE_DB_PASSWORD=... (uses project ref from EXPO_PUBLIC_SUPABASE_URL)
 *
 * Usage:
 *   SUPABASE_DB_PASSWORD=... node scripts/apply-migration-0039.mjs
 *   SUPABASE_DB_PASSWORD=... node scripts/apply-migration-0039.mjs --dry-run
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dryRun = process.argv.includes("--dry-run");

const projectRef =
  process.env.SUPABASE_PROJECT_REF ??
  (process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "")
    .replace(/^https:\/\//, "")
    .replace(/\.supabase\.co.*$/, "");

function buildConnectionString() {
  if (process.env.SUPABASE_DB_URL?.trim()) {
    return process.env.SUPABASE_DB_URL.trim();
  }
  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  if (!password || !projectRef) return null;
  const hosts = [
    `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`,
  ];
  return hosts;
}

const SCHEMA_SQL = fs.readFileSync(
  path.join(__dirname, "../supabase/migrations/0039_masterpiece_library_validation.sql"),
  "utf8"
);

/** Strip cron scheduling — growth stays disabled until explicitly enabled. */
const SCHEMA_ONLY_SQL = SCHEMA_SQL.replace(
  /-- Daily quiet growth[\s\S]*$/m,
  `-- Cron scheduling intentionally omitted. Enable via scripts/enable-masterpiece-growth-cron.mjs after library QA.\n`
);

async function verify(client) {
  const cols = await client.query(`
    select column_name, data_type, is_nullable
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'kindred_hero_artwork'
      and column_name in ('validation_status', 'last_shown_date', 'use_count', 'last_used_at')
    order by column_name;
  `);

  const idx = await client.query(`
    select indexname
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'kindred_hero_artwork'
      and indexname = 'kindred_hero_artwork_validation_ready_idx';
  `);

  const counts = await client.query(`
    select
      count(*)::int as total,
      count(*) filter (where validation_status = 'approved')::int as approved,
      count(*) filter (where validation_status = 'needs_review')::int as needs_review,
      count(*) filter (where validation_status = 'rejected')::int as rejected
    from public.kindred_hero_artwork;
  `);

  const freeze = await client.query(`
    select edition_date, artwork_id
    from public.kindred_hero_artwork_edition_selections
    where edition_date = current_date
    limit 1;
  `);

  const cron = await client.query(`
    select jobname, schedule, active
    from cron.job
    where jobname like 'grow-hero-artwork-library%';
  `).catch(() => ({ rows: [] }));

  return {
    columns: cols.rows,
    indexPresent: idx.rows.length > 0,
    validationCounts: counts.rows[0],
    todayFreeze: freeze.rows[0] ?? null,
    growthCronJobs: cron.rows,
  };
}

async function main() {
  const candidates = buildConnectionString();
  if (!candidates) {
    console.error(
      "Set SUPABASE_DB_URL or SUPABASE_DB_PASSWORD (+ EXPO_PUBLIC_SUPABASE_URL for project ref)."
    );
    process.exit(1);
  }

  const urls = Array.isArray(candidates) ? candidates : [candidates];
  let client;
  let connectedUrl = null;

  for (const url of urls) {
    const attempt = new pg.Client({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
    });
    try {
      await attempt.connect();
      client = attempt;
      connectedUrl = url.replace(/:[^:@/]+@/, ":***@");
      break;
    } catch {
      await attempt.end().catch(() => {});
    }
  }

  if (!client) {
    console.error("Could not connect to Postgres with provided credentials.");
    process.exit(1);
  }

  console.log("Connected:", connectedUrl);

  if (dryRun) {
    console.log("Dry run — SQL to apply:\n", SCHEMA_ONLY_SQL);
    await client.end();
    return;
  }

  await client.query("BEGIN");
  try {
    await client.query(SCHEMA_ONLY_SQL);
    await client.query("COMMIT");
    console.log("Migration 0039 applied (schema + backfill, no cron).");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }

  const verification = await verify(client);
  console.log(JSON.stringify(verification, null, 2));
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
