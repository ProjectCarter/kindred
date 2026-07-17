/**
 * Sanitize corrupt Wikimedia/Wikidata metadata on existing library rows.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/sanitize-hero-library-metadata.mjs
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/sanitize-hero-library-metadata.mjs --dry-run
 */
import { createClient } from "@supabase/supabase-js";
import {
  sanitizeArtworkTitle,
  sanitizeArtistName,
  sanitizeArtworkYear,
  containsWikidataSyntax,
} from "./lib/sanitizeWikimediaMetadata.mjs";
import { resolveArtworkYear } from "./lib/resolveArtworkYear.mjs";
import { buildMasterpieceCreditLine } from "./lib/masterpieceCredit.mjs";

const dryRun = process.argv.includes("--dry-run");

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

async function main() {
  const { data: rows, error } = await admin.from("kindred_hero_artwork").select("*");
  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  let updated = 0;
  let skipped = 0;

  for (const row of rows ?? []) {
    const fileHint = row.source_url?.includes("commons.wikimedia.org")
      ? row.source_url.split("/wiki/").pop()?.replace(/_/g, " ")
      : null;

    const title = sanitizeArtworkTitle(row.artwork_title, {
      filePageTitle: fileHint ? \`File:\${fileHint}\` : null,
      objectName:
        row.source_provider === 'wikimedia' ? row.tags?.[0] : undefined,
    });
    const artist = sanitizeArtistName(row.artist, fileHint ? `File:${fileHint}` : null);
    const year =
      sanitizeArtworkYear(row.year, {
        title: row.artwork_title,
        filePageTitle: fileHint ? `File:${fileHint}` : null,
      }) ??
      resolveArtworkYear({
        year: row.year,
        artworkTitle: title,
        sourceUrl: row.source_url,
        tags: row.tags,
        aboutArtworkBody: row.about_artwork_body,
      });

    const attribution = containsWikidataSyntax(row.attribution_text)
      ? buildMasterpieceCreditLine({
          artist,
          license: row.license,
          sourceInstitution: row.source_institution,
          sourceProvider: row.source_provider,
          mediumHint: row.tags?.[0],
          collections: row.collections,
        })
      : row.attribution_text;

    const dirty =
      containsWikidataSyntax(row.artwork_title) ||
      containsWikidataSyntax(row.artist) ||
      containsWikidataSyntax(row.year) ||
      containsWikidataSyntax(row.attribution_text) ||
      title !== row.artwork_title?.trim() ||
      artist !== row.artist?.trim() ||
      (year && year !== row.year) ||
      attribution !== row.attribution_text;

    if (!dirty) {
      skipped++;
      continue;
    }

    console.log("sanitize", {
      id: row.id,
      before: row.artwork_title?.slice(0, 60),
      after: title,
      year,
    });

    if (!dryRun) {
      const { error: updateError } = await admin
        .from("kindred_hero_artwork")
        .update({
          artwork_title: title,
          artist,
          year: year ?? row.year,
          attribution_text: attribution,
        })
        .eq("id", row.id);
      if (updateError) {
        console.error("  failed:", updateError.message);
        continue;
      }
    }
    updated++;
  }

  console.log(JSON.stringify({ updated, skipped, dryRun }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
