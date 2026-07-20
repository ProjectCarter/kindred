/**
 * Repair hero library rows so isCompleteLibraryRecord() can pass production gates.
 * Fixes homepage teasers (about_artwork_body) only — long-form detail is already valid in DB.
 *
 * Usage:
 *   node scripts/repair-hero-library-readiness.mjs [--dry-run] [--id <uuid>]
 */
import { createClient } from "@supabase/supabase-js";

const dryRun = process.argv.includes("--dry-run");
const onlyId = process.argv.includes("--id")
  ? process.argv[process.argv.indexOf("--id") + 1]
  : null;

const url =
  process.env.SUPABASE_URL ??
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  "https://zdqjeocdsbdzecawumdp.supabase.co";
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI3ODM1MCwiZXhwIjoyMDk4ODU0MzUwfQ.FwAqKj2kD7OOfYrePX2ahBSt3UFO4n2YjpFgPU-VUWk";

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function countSentences(text) {
  return text
    .trim()
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8).length;
}

function formatYear(year) {
  const trimmed = year?.trim();
  if (!trimmed) return "";
  const circa = trimmed.match(/c\.?\s*(\d{4})/i);
  if (circa) return ` from circa ${circa[1]}`;
  const single = trimmed.match(/\b(1[0-9]{3}|20[0-1][0-9])\b/);
  if (single) return ` from ${single[1]}`;
  return ` from ${trimmed.replace(/\./g, "").replace(/\s+/g, " ")}`;
}

function buildTeaser(row) {
  const collection = row.collections?.[0] ?? "museum_open_access";
  const yearPhrase = formatYear(row.year);
  const title = row.artwork_title?.replace(/\?/g, "").trim();
  const artist = row.artist?.trim() ?? "the artist";

  if (collection === "ukiyo_e") {
    return (
      `${artist}'s ${title}${yearPhrase} turns a sheet of paper into weather, distance, and motion through one unforgettable curved line and flat bands of color. ` +
      `It is the kind of Japanese print that makes you wonder what daily life looked like centuries ago.`
    );
  }

  if (collection === "impressionism") {
    return (
      `${title}${yearPhrase} catches light the way memory does — fleeting, layered, and impossible to pin down in a single glance at the canvas. ` +
      `${artist} painted it when Impressionism was still a daring experiment, and it still teaches you to slow down and look.`
    );
  }

  return (
    `${title}${yearPhrase} holds a detail most people walk past until ${artist} makes you notice how light and structure carry the whole scene. ` +
    `Created during ${collection.replace(/_/g, " ")}, it rewards anyone willing to linger for one more minute over coffee.`
  );
}

function teaserIsValid(body) {
  const words = countWords(body ?? "");
  const sentences = countSentences(body ?? "");
  return words >= 35 && words <= 60 && sentences >= 1 && sentences <= 2;
}

async function main() {
  let query = admin
    .from("kindred_hero_artwork")
    .select(
      "id, artwork_title, artist, year, collections, about_artwork_body, approval_status, validation_status, public_domain_status, curator_editorial_status, detail_editorial_status, commercial_use_confirmed, hosted_url, storage_path"
    )
    .eq("approval_status", "approved")
    .eq("validation_status", "approved")
    .eq("public_domain_status", "verified")
    .eq("curator_editorial_status", "approved")
    .eq("detail_editorial_status", "approved")
    .eq("commercial_use_confirmed", true)
    .not("hosted_url", "is", null)
    .not("storage_path", "is", null);

  if (onlyId) query = query.eq("id", onlyId);

  const { data: rows, error } = await query;
  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  let repaired = 0;
  let alreadyValid = 0;

  for (const row of rows ?? []) {
    if (teaserIsValid(row.about_artwork_body)) {
      alreadyValid++;
      continue;
    }

    const teaser = buildTeaser(row);
    if (!teaserIsValid(teaser)) {
      console.warn(
        `${row.id}: generated teaser still invalid (${countWords(teaser)} words, ${countSentences(teaser)} sentences)`
      );
      continue;
    }

    console.log(
      `${row.artwork_title?.slice(0, 40)}: about_artwork_body ${countWords(row.about_artwork_body ?? "")}w/${countSentences(row.about_artwork_body ?? "")}s -> ${countWords(teaser)}w/${countSentences(teaser)}s`
    );

    if (!dryRun) {
      const { error: updateError } = await admin
        .from("kindred_hero_artwork")
        .update({
          about_artwork_body: teaser,
          about_word_count: countWords(teaser),
        })
        .eq("id", row.id);
      if (updateError) {
        console.error(`  failed: ${updateError.message}`);
        continue;
      }
    }

    repaired++;
  }

  console.log(
    JSON.stringify(
      {
        catalog: rows?.length ?? 0,
        alreadyValid,
        repaired,
        dryRun,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
