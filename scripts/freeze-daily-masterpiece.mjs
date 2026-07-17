/**
 * Freeze Today's Masterpiece — library read/freeze only (no runtime synthesis).
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/freeze-daily-masterpiece.mjs
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/freeze-daily-masterpiece.mjs --edition-date=2026-07-18
 */
import { createClient } from "@supabase/supabase-js";
import { validateDetailFields } from "./lib/masterpieceDetail.mjs";

const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  "https://zdqjeocdsbdzecawumdp.supabase.co";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const editionDate =
  args.find((a) => a.startsWith("--edition-date="))?.split("=")[1] ??
  args[args.indexOf("--edition-date") + 1] ??
  new Date().toISOString().slice(0, 10);

if (!SERVICE_KEY) {
  console.error("Set SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function detailFromStoredRow(row) {
  const editorial = row.editorial_sections;
  if (!editorial) return null;

  const sections = [
    { heading: "Introduction", paragraphs: [editorial.introduction] },
    { heading: "About the Artist", paragraphs: [editorial.aboutTheArtist] },
    {
      heading: "The Story Behind the Artwork",
      paragraphs: editorial.storyBehindArtwork.split(/\n{2,}/).map((p) => p.trim()),
    },
    { heading: "Historical Context", paragraphs: [editorial.historicalContext] },
    { heading: "Legacy", paragraphs: [editorial.legacy] },
    {
      heading: "Editorial Reflection",
      paragraphs: [editorial.editorialReflection ?? editorial.editorialClosing],
    },
  ];

  return {
    sections,
    lookingCloser: row.look_closer_items,
    didYouKnow: row.did_you_know,
    museumName: row.museum_name,
    museumLocation: row.museum_location,
    officialMuseumUrl: row.official_museum_url,
    officialArtworkUrl: row.official_artwork_url,
    sourceReferences: row.source_references ?? [],
  };
}

function isApprovedLibraryRow(row) {
  return (
    row.validation_status === "approved" &&
    row.approval_status === "approved" &&
    row.detail_editorial_status === "approved" &&
    row.public_domain_status === "verified" &&
    row.hosted_url?.trim() &&
    row.about_artwork_body?.trim() &&
    row.artwork_title?.trim() &&
    row.artist?.trim() &&
    row.year?.trim() &&
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
    })
  );
}

function buildMorningHeroFromStored(row, date) {
  const detail = detailFromStoredRow(row);
  if (!detail) {
    throw new Error(`Stored detail incomplete for ${row.id}`);
  }

  const teaser = row.about_artwork_body.trim();
  return {
    editionDate: date,
    artworkId: row.id,
    artworkTitle: row.artwork_title.trim(),
    artist: row.artist.trim(),
    year: row.year.trim(),
    sourceInstitution: row.source_institution.trim(),
    sourceUrl: row.source_url.trim(),
    license: row.license,
    licenseUrl: row.license_url,
    hostedUrl: row.hosted_url.trim(),
    imageUrl: row.hosted_url.trim(),
    imageWidth: row.image_width ?? 1400,
    imageHeight: row.image_height ?? 933,
    aspectRatio: row.aspect_ratio ?? 1.5,
    creditLine: row.attribution_text.trim(),
    aboutArtworkBody: teaser,
    aboutWordCount: countWords(teaser),
    collections: row.collections ?? [],
    detail,
  };
}

function daySeed(date) {
  const [y, m, d] = date.split("-").map(Number);
  return y * 372 + m * 31 + d;
}

async function pickArtworkForDate(date) {
  const { data: recent } = await admin
    .from("kindred_hero_artwork_edition_selections")
    .select("artwork_id, edition_date")
    .order("edition_date", { ascending: false })
    .limit(14);

  const recentIds = new Set((recent ?? []).map((r) => r.artwork_id));

  const { data: library, error } = await admin
    .from("kindred_hero_artwork")
    .select("*")
    .eq("validation_status", "approved")
    .order("last_shown_date", { ascending: true, nullsFirst: true })
    .order("use_count", { ascending: true });

  if (error) throw new Error(error.message);

  const eligible = (library ?? []).filter(isApprovedLibraryRow);
  if (eligible.length === 0) {
    throw new Error("No approved masterpiece library artwork ready");
  }

  const fresh = eligible.filter((row) => !recentIds.has(row.id));
  const pool = fresh.length > 0 ? fresh : eligible;
  const idx = daySeed(date) % pool.length;
  return pool[idx];
}

async function verifyImageUrl(url) {
  const res = await fetch(url, { method: "HEAD" });
  return res.ok;
}

async function main() {
  const { data: existing } = await admin
    .from("kindred_hero_artwork_edition_selections")
    .select("*")
    .eq("edition_date", editionDate)
    .maybeSingle();

  let morningHero;
  let artworkId;

  if (existing?.presentation_snapshot?.hostedUrl && existing?.artwork_id) {
    morningHero = existing.presentation_snapshot;
    artworkId = existing.artwork_id;
    console.log("Frozen selection already exists:", {
      editionDate,
      artworkId,
      title: morningHero.artworkTitle,
    });
  } else {
    const artwork = await pickArtworkForDate(editionDate);
    morningHero = buildMorningHeroFromStored(artwork, editionDate);
    artworkId = artwork.id;
    console.log("Selected artwork for freeze:", {
      editionDate,
      artworkId,
      title: morningHero.artworkTitle,
      artist: morningHero.artist,
    });
  }

  const imageOk = await verifyImageUrl(morningHero.hostedUrl);
  if (!imageOk) {
    throw new Error(`Hosted image not reachable: ${morningHero.hostedUrl}`);
  }

  if (dryRun) {
    console.log("Dry run — no writes.", { editionDate, artworkId, imageOk });
    return;
  }

  if (!existing?.artwork_id) {
    const { error: freezeError } = await admin
      .from("kindred_hero_artwork_edition_selections")
      .upsert(
        {
          edition_date: editionDate,
          artwork_id: artworkId,
          selection_context: {
            source: "freeze-daily-masterpiece.mjs",
            editionDate,
          },
          presentation_snapshot: morningHero,
          selected_at: new Date().toISOString(),
        },
        { onConflict: "edition_date" }
      );
    if (freezeError) throw new Error(freezeError.message);

    const { data: usageRow } = await admin
      .from("kindred_hero_artwork")
      .select("use_count")
      .eq("id", artworkId)
      .single();

    await admin
      .from("kindred_hero_artwork")
      .update({
        last_used_at: new Date().toISOString(),
        last_shown_date: editionDate,
        use_count: (usageRow?.use_count ?? 0) + 1,
      })
      .eq("id", artworkId);

    console.log("Created frozen selection row.");
  }

  console.log(`Done for ${editionDate}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
