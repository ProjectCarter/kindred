/**
 * Backfill masterpiece detail fields on existing hero artwork rows.
 * Run: node scripts/backfill-hero-detail.mjs [--dry-run]
 */
import { createClient } from "@supabase/supabase-js";
import { buildMasterpieceDetail } from "./lib/masterpieceDetail.mjs";

const dryRun = process.argv.includes("--dry-run");

const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function hasDetail(row) {
  return (
    row.detail_editorial_status === "approved" &&
    row.long_story_body?.trim() &&
    row.artist_biography?.trim() &&
    Array.isArray(row.look_closer_items) &&
    row.look_closer_items.length >= 2 &&
    row.did_you_know?.trim()
  );
}

async function main() {
  const { data: rows, error } = await admin
    .from("kindred_hero_artwork")
    .select(
      "id, artwork_title, artist, year, source_institution, source_url, collections, long_story_body, detail_editorial_status, artist_biography, look_closer_items, did_you_know"
    );

  if (error) {
    console.error("Fetch failed:", error.message);
    process.exit(1);
  }

  let updated = 0;
  let skipped = 0;

  for (const row of rows ?? []) {
    if (hasDetail(row)) {
      skipped++;
      continue;
    }

    const collection = row.collections?.[0] ?? "museum_open_access";
    const detail = buildMasterpieceDetail({
      title: row.artwork_title,
      artist: row.artist,
      year: row.year,
      medium: "traditional materials",
      period: collection.replace(/_/g, " "),
      institution: row.source_institution,
      sourceUrl: row.source_url,
      collection,
    });

    console.log(`${row.id}: detail ready (${detail.long_story_paragraph_count} paragraphs)`);

    if (!dryRun) {
      const { error: updateError } = await admin
        .from("kindred_hero_artwork")
        .update(detail)
        .eq("id", row.id);

      if (updateError) {
        console.error(`  failed: ${updateError.message}`);
        continue;
      }
    }

    updated++;
  }

  console.log(
    `\nDone. ${updated} updated, ${skipped} skipped${dryRun ? " (dry run)" : ""}.`
  );
}

main();
