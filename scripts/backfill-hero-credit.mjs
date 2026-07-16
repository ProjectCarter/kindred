/**
 * Backfill museum-quality credit lines on existing hero artwork rows.
 * Run: node scripts/backfill-hero-credit.mjs [--dry-run]
 */
import { createClient } from "@supabase/supabase-js";
import { buildMasterpieceCreditLine } from "./lib/masterpieceCredit.mjs";

const dryRun = process.argv.includes("--dry-run");

const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

function looksMuseumStyle(text) {
  if (!text?.trim()) return false;
  return (
    / by .+ • /.test(text) ||
    /courtesy of/i.test(text) ||
    /Courtesy of Unsplash/i.test(text) ||
    /Licensed via Pexels/i.test(text)
  );
}

async function main() {
  const { data: rows, error } = await supabase
    .from("kindred_hero_artwork")
    .select(
      "id, artist, license, source_institution, source_provider, collections, tags, attribution_text"
    );

  if (error) {
    console.error("Fetch failed:", error.message);
    process.exit(1);
  }

  let updated = 0;
  let skipped = 0;

  for (const row of rows ?? []) {
    if (looksMuseumStyle(row.attribution_text)) {
      skipped++;
      continue;
    }

    const creditLine = buildMasterpieceCreditLine({
      artist: row.artist ?? "Unknown artist",
      license: row.license ?? "public_domain",
      sourceInstitution: row.source_institution ?? "Open collection",
      sourceProvider: row.source_provider,
      collections: row.collections ?? [],
      tags: row.tags ?? [],
    });

    if (creditLine === row.attribution_text?.trim()) {
      skipped++;
      continue;
    }

    console.log(`${row.id}: ${creditLine}`);

    if (!dryRun) {
      const { error: updateError } = await supabase
        .from("kindred_hero_artwork")
        .update({ attribution_text: creditLine })
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
