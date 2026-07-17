/**
 * Recompute validation_status for all library rows after backfill.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/recompute-hero-validation-status.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { validateDetailFields } from "./lib/masterpieceDetail.mjs";

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

const WIKIDATA_RE = /QS:|(?:^|\s)P\d{5,}|wikibase/i;

function hasCorruptMetadata(row) {
  return [row.artwork_title, row.artist, row.year, row.about_artwork_body, row.long_story_body].some(
    (f) => typeof f === "string" && WIKIDATA_RE.test(f)
  );
}

function computeStatus(row) {
  if (
    row.approval_status === "rejected" ||
    row.detail_editorial_status === "rejected" ||
    row.public_domain_status === "rejected" ||
    row.curator_editorial_status === "rejected"
  ) {
    return "rejected";
  }

  const detailOk =
    row.detail_editorial_status === "approved" &&
    validateDetailFields({
      long_story_body: row.long_story_body,
      artist_biography: row.artist_biography,
      look_closer_items: row.look_closer_items,
      did_you_know: row.did_you_know,
      museum_name: row.museum_name,
      museum_location: row.museum_location,
      official_artwork_url: row.official_artwork_url,
      official_museum_url: row.official_museum_url,
      editorial_sections: row.editorial_sections,
    });

  const approved =
    row.approval_status === "approved" &&
    row.curator_editorial_status === "approved" &&
    row.public_domain_status === "verified" &&
    row.commercial_use_confirmed === true &&
    row.hosted_url?.trim() &&
    row.storage_path?.trim() &&
    row.artwork_title?.trim() &&
    row.artist?.trim() &&
    row.year?.trim() &&
    row.source_institution?.trim() &&
    row.license?.trim() &&
    row.attribution_text?.trim() &&
    row.about_artwork_body?.trim() &&
    detailOk &&
    !hasCorruptMetadata(row);

  return approved ? "approved" : "needs_review";
}

async function main() {
  const { data: rows, error } = await admin.from("kindred_hero_artwork").select("*");
  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const counts = { approved: 0, needs_review: 0, rejected: 0, updated: 0 };

  for (const row of rows ?? []) {
    const next = computeStatus(row);
    counts[next]++;
    if (next === row.validation_status) continue;

    const { error: updateError } = await admin
      .from("kindred_hero_artwork")
      .update({ validation_status: next })
      .eq("id", row.id);
    if (updateError) {
      console.error(row.id, updateError.message);
      continue;
    }
    counts.updated++;
  }

  console.log(JSON.stringify(counts, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
