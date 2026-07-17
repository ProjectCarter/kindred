/**
 * Apply History Around Town migrations 0040 + 0041 (schema + image provenance).
 *
 * Requires one of:
 *   SUPABASE_DB_URL=postgresql://...
 *   SUPABASE_DB_PASSWORD=... (uses project ref from EXPO_PUBLIC_SUPABASE_URL)
 *
 * Usage:
 *   SUPABASE_DB_PASSWORD=... node scripts/apply-migration-0040-history-around-town.mjs
 *   SUPABASE_DB_PASSWORD=... node scripts/apply-migration-0040-history-around-town.mjs --dry-run
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
  return [
    `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`,
  ];
}

const SCHEMA_SQL = [
  fs.readFileSync(
    path.join(__dirname, "apply-history-around-town-schema.sql"),
    "utf8"
  ),
  fs.readFileSync(
    path.join(__dirname, "../supabase/migrations/0041_history_places_image_provenance.sql"),
    "utf8"
  ),
  fs.readFileSync(
    path.join(__dirname, "../supabase/migrations/0042_history_places_image_verification.sql"),
    "utf8"
  ),
].join("\n\n");

async function verify(client) {
  const table = await client.query(`
    select count(*)::int as n
    from information_schema.tables
    where table_schema = 'public' and table_name = 'kindred_history_places';
  `);

  const cols = await client.query(`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'kindred_history_places'
      and column_name in ('image_photographer', 'image_era', 'image_date')
    order by column_name;
  `);

  const editionCol = await client.query(`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'editions'
      and column_name = 'history_around_town';
  `);

  return {
    tableExists: (table.rows[0]?.n ?? 0) > 0,
    imageProvenanceColumns: cols.rows.map((r) => r.column_name),
    editionColumn: editionCol.rows.length > 0,
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
    console.log("Dry run — SQL to apply:\n", SCHEMA_SQL);
    await client.end();
    return;
  }

  await client.query("BEGIN");
  try {
    await client.query(SCHEMA_SQL);
    await client.query("COMMIT");
    console.log("Migrations 0040 + 0041 applied.");
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
