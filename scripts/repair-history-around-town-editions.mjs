/**
 * Embed frozen history_around_town snapshots into existing editions.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/repair-history-around-town-editions.mjs
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/repair-history-around-town-editions.mjs --edition-date=2026-07-17
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/repair-history-around-town-editions.mjs --dry-run
 */
import { createClient } from "@supabase/supabase-js";
import {
  buildHistoryAroundTownSnapshot,
  metroKeyFromLocation,
} from "./lib/historyAroundTownSnapshot.mjs";

const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  "https://zdqjeocdsbdzecawumdp.supabase.co";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");
const editionDate =
  args.find((a) => a.startsWith("--edition-date="))?.split("=")[1] ??
  (args.includes("--edition-date")
    ? args[args.indexOf("--edition-date") + 1]
    : null) ??
  new Date().toISOString().slice(0, 10);

if (!SERVICE_KEY) {
  console.error("Set SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function locationFromEdition(row) {
  const discovery = row.discovery;
  const editorial = row.editorial_context;
  const fromDiscovery = discovery?.location;
  if (fromDiscovery?.city?.trim()) {
    return {
      city: fromDiscovery.city.trim(),
      state: fromDiscovery.state ?? fromDiscovery.region ?? null,
      region: fromDiscovery.region ?? null,
    };
  }
  const fromEditorial = editorial?.location;
  if (fromEditorial?.city?.trim()) {
    return {
      city: fromEditorial.city.trim(),
      state: fromEditorial.state ?? fromEditorial.region ?? null,
      region: fromEditorial.region ?? null,
    };
  }
  return null;
}

async function loadApprovedPlaces(metroKey) {
  const { data, error } = await admin
    .from("kindred_history_places")
    .select("*")
    .eq("metro_key", metroKey)
    .eq("validation_status", "approved")
    .order("featured", { ascending: false })
    .order("editorial_priority", { ascending: false })
    .order("place_name", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

async function main() {
  const { data: editions, error } = await admin
    .from("editions")
    .select(
      "id, user_id, edition_date, discovery, editorial_context, history_around_town"
    )
    .eq("edition_date", editionDate)
    .eq("status", "ready");

  if (error) {
    console.error("Edition query failed:", error.message);
    process.exit(1);
  }

  console.log(`Repair History Around Town — ${editionDate}`);
  console.log(`Ready editions: ${editions?.length ?? 0}`);

  const snapshotCache = new Map();
  let patched = 0;
  let skipped = 0;
  let already = 0;

  for (const edition of editions ?? []) {
    const location = locationFromEdition(edition);
    if (!location?.city || location.city.toLowerCase() === "your area") {
      skipped++;
      continue;
    }

    const metroKey = metroKeyFromLocation(location);
    let snapshot = snapshotCache.get(metroKey);
    if (!snapshot) {
      const rows = await loadApprovedPlaces(metroKey);
      snapshot = buildHistoryAroundTownSnapshot(rows, metroKey);
      snapshotCache.set(metroKey, snapshot);
      console.log(`  library ${metroKey}: ${rows.length} approved → snapshot ${snapshot ? `${snapshot.carousel.length}/${snapshot.places.length}` : "null"}`);
    }

    if (!snapshot) {
      skipped++;
      continue;
    }

    const existing = edition.history_around_town;
  if (
    !force &&
    existing?.places?.length === snapshot.places.length &&
    existing?.carousel?.length === snapshot.carousel.length &&
    existing?.metroKey === snapshot.metroKey
  ) {
      already++;
      continue;
    }

    if (dryRun) {
      console.log(`  would patch edition ${edition.id} (${metroKey})`);
      patched++;
      continue;
    }

    const { error: updateError } = await admin
      .from("editions")
      .update({ history_around_town: snapshot })
      .eq("id", edition.id);

    if (updateError) {
      console.error(`  failed ${edition.id}:`, updateError.message);
      process.exit(1);
    }
    patched++;
  }

  console.log(`\nSummary: patched=${patched} already_ok=${already} skipped=${skipped}${dryRun ? " (dry-run)" : ""}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
