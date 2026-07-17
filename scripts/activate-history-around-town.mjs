/**
 * Full History Around Town activation:
 *   1. Apply migrations 0040 + 0041 (Postgres)
 *   2. Seed Gilbert library
 *   3. Audit library + verify image URLs
 *   4. Embed frozen snapshot into today's ready editions
 *
 * Usage:
 *   SUPABASE_DB_PASSWORD=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/activate-history-around-town.mjs
 */
import { spawnSync } from "child_process";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dryRun = process.argv.includes("--dry-run");
const editionDate =
  process.env.EDITION_DATE ?? new Date().toISOString().slice(0, 10);

const url =
  process.env.SUPABASE_URL ??
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  "https://zdqjeocdsbdzecawumdp.supabase.co";
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

if (!key) {
  console.error("Set SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function runNode(script, extraArgs = []) {
  const args = [path.join(__dirname, script), ...extraArgs];
  if (dryRun) args.push("--dry-run");
  const result = spawnSync("node", args, {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function reportEditionSnapshot() {
  const { data, error } = await admin
    .from("editions")
    .select("id, user_id, history_around_town")
    .eq("edition_date", editionDate)
    .eq("status", "ready");

  if (error) throw new Error(error.message);

  const withSnapshot = (data ?? []).filter(
    (e) => e.history_around_town?.places?.length > 0
  );
  const sample = withSnapshot[0]?.history_around_town;

  console.log(`\nEdition snapshot report (${editionDate}):`);
  console.log(`  ready editions: ${data?.length ?? 0}`);
  console.log(`  with history_around_town: ${withSnapshot.length}`);
  if (sample) {
    console.log(
      `  sample: carousel=${sample.carousel?.length ?? 0} places=${sample.places?.length ?? 0} metro=${sample.metroKey}`
    );
    console.log(`  subtitle: ${sample.subtitle ?? "(missing)"}`);
  }

  return {
    ready: data?.length ?? 0,
    embedded: withSnapshot.length,
    carousel: sample?.carousel?.length ?? 0,
    places: sample?.places?.length ?? 0,
  };
}

async function main() {
  console.log("History Around Town activation\n");

  const { error: probeError } = await admin
    .from("kindred_history_places")
    .select("id")
    .limit(1);

  if (probeError?.message?.includes("Could not find the table")) {
    console.log("Applying migrations 0040 + 0041...");
    runNode("apply-migration-0040-history-around-town.mjs");
  } else if (probeError) {
    console.error("Library probe failed:", probeError.message);
    process.exit(1);
  } else {
    console.log("✓ kindred_history_places table exists");
    runNode("apply-migration-0040-history-around-town.mjs");
  }

  runNode("seed-history-around-town-gilbert.mjs");
  runNode("audit-history-around-town-library.mjs", [
    "--metro",
    "gilbert-az",
    "--verify-images",
    "--write-image-status",
  ]);

  runNode("repair-history-around-town-editions.mjs", [
    "--edition-date",
    editionDate,
  ]);

  const report = await reportEditionSnapshot();

  console.log("\nActivation complete.");
  console.log(
    JSON.stringify(
      {
        editionDate,
        libraryPlaces: report.places,
        editionsEmbedded: report.embedded,
        carouselCards: report.carousel,
        dryRun,
      },
      null,
      2
    )
  );

  if (!dryRun && report.embedded === 0) {
    console.warn(
      "\nNo editions embedded — ensure a ready edition exists for today with Gilbert location, or run scripts/regenerate-edition.ts"
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
