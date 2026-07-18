/**
 * Apply migration 0047 (edition metro_key identity) only.
 * Uses linked Supabase project via CLI — does NOT run db push / include-all.
 *
 * Usage:
 *   node scripts/apply-migration-0047-edition-metro-identity.mjs --pre-check
 *   node scripts/apply-migration-0047-edition-metro-identity.mjs --apply
 *   node scripts/apply-migration-0047-edition-metro-identity.mjs --verify
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const MIGRATION_FILE = path.join(
  ROOT,
  "supabase/migrations/0047_edition_metro_identity.sql"
);
const BACKUP_DIR = path.join(ROOT, "scripts/.migration-backups");
const STAMP = new Date().toISOString().replace(/[:.]/g, "-");
const BACKUP_FILE = path.join(BACKUP_DIR, `0047-pre-${STAMP}.json`);

const PRE_CHECK_SQL = `
select
  (select count(*)::int from public.editions) as edition_count,
  (select count(*)::int from public.edition_sections) as section_count,
  (select count(*)::int from public.profiles) as profile_count,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'editions' and column_name = 'metro_key'
  ) as metro_key_column_exists;
`;

const CONSTRAINTS_SQL = `
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.editions'::regclass
order by conname;
`;

const INDEXES_SQL = `
select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'editions'
order by indexname;
`;

const EDITIONS_SAMPLE_SQL = `
select id, user_id, edition_date, status,
  discovery->'location'->>'city' as discovery_city,
  discovery->'location'->>'state' as discovery_state
from public.editions
order by edition_date desc, created_at desc
limit 20;
`;

const EDITIONS_SAMPLE_AFTER_SQL = `
select id, user_id, edition_date, status, metro_key,
  discovery->'location'->>'city' as discovery_city,
  discovery->'location'->>'state' as discovery_state
from public.editions
order by edition_date desc, created_at desc
limit 20;
`;

const VERIFY_SQL = `
select
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'editions' and column_name = 'metro_key'
  ) as metro_key_column_exists,
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.editions'::regclass
      and conname = 'editions_user_id_edition_date_key'
  ) as old_unique_still_present,
  exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'editions_user_date_metro_unique'
  ) as new_metro_unique_index,
  exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'editions_user_date_legacy_unique'
  ) as legacy_unique_index,
  (select count(*)::int from public.editions) as edition_count,
  (select count(*)::int from public.edition_sections) as section_count,
  (select count(*)::int from public.editions where metro_key is not null) as editions_with_metro,
  (select count(*)::int from public.editions where metro_key is null) as editions_without_metro,
  (select count(*)::int from public.editions where status = 'ready' and metro_key is null) as ready_without_metro;
`;

function runQuery(sql, label) {
  const tmp = path.join(BACKUP_DIR, `_tmp-${label}.sql`);
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.writeFileSync(tmp, sql);
  try {
    const out = execSync(`npx supabase db query --linked -f "${tmp}"`, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return out;
  } finally {
    fs.unlinkSync(tmp);
  }
}

function readLinkedProject() {
  const raw = fs.readFileSync(
    path.join(ROOT, "supabase/.temp/linked-project.json"),
    "utf8"
  );
  return JSON.parse(raw);
}

async function preCheck() {
  const linked = readLinkedProject();
  console.log("Linked project:", linked.name, linked.ref);

  const snapshot = {
    capturedAt: new Date().toISOString(),
    project: linked,
    counts: runQuery(PRE_CHECK_SQL, "counts"),
    constraints: runQuery(CONSTRAINTS_SQL, "constraints"),
    indexes: runQuery(INDEXES_SQL, "indexes"),
    editionsSample: runQuery(EDITIONS_SAMPLE_SQL, "editions"),
  };

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.writeFileSync(BACKUP_FILE, JSON.stringify(snapshot, null, 2));
  console.log("Pre-migration snapshot saved:", BACKUP_FILE);
  console.log(snapshot.counts);
  return snapshot;
}

function applyMigration() {
  console.log("Applying:", MIGRATION_FILE);
  execSync(`npx supabase db query --linked -f "${MIGRATION_FILE}"`, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: "inherit",
  });

  const markApplied = `
insert into supabase_migrations.schema_migrations (version)
values ('0047')
on conflict (version) do nothing;
`;
  runQuery(markApplied, "mark-applied");
  console.log("Migration 0047 applied and recorded in schema_migrations.");
}

function verify() {
  console.log(runQuery(VERIFY_SQL, "verify"));
  console.log(runQuery(CONSTRAINTS_SQL, "constraints-after"));
  console.log(runQuery(INDEXES_SQL, "indexes-after"));
  console.log(runQuery(EDITIONS_SAMPLE_AFTER_SQL, "editions-after"));
}

const mode = process.argv[2] ?? "--pre-check";
if (mode === "--pre-check") {
  preCheck();
} else if (mode === "--apply") {
  applyMigration();
  verify();
} else if (mode === "--verify") {
  verify();
} else {
  console.error("Usage: --pre-check | --apply | --verify");
  process.exit(1);
}
