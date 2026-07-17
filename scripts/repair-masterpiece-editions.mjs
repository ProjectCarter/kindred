/**
 * Repair frozen morning editions missing masterpiece detail articles.
 *
 * Patches:
 * - kindred_hero_artwork_edition_selections.presentation_snapshot
 * - editions.morning_edition.morningHero (all rows for edition_date)
 *
 * Usage:
 *   node scripts/repair-masterpiece-editions.mjs
 *   node scripts/repair-masterpiece-editions.mjs --edition-date=2026-07-16
 *   node scripts/repair-masterpiece-editions.mjs --dry-run
 */
import { createClient } from "@supabase/supabase-js";
import { buildMasterpieceDetail, buildHomepageTeaser } from "./lib/masterpieceDetail.mjs";
import { resolveArtworkYear } from "./lib/resolveArtworkYear.mjs";

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

function detailFromFields(fields) {
  const editorial = fields.editorial_sections;
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
      paragraphs: [
        editorial.editorialReflection ?? editorial.editorialClosing,
      ],
    },
  ];

  return {
    sections,
    lookingCloser: fields.look_closer_items,
    didYouKnow: fields.did_you_know,
    museumName: fields.museum_name,
    museumLocation: fields.museum_location,
    officialMuseumUrl: fields.official_museum_url,
    officialArtworkUrl: fields.official_artwork_url,
    sourceReferences: fields.source_references ?? [],
  };
}

function isDetailComplete(detail) {
  return (
    detail?.sections?.length >= 6 &&
    detail.lookingCloser?.length >= 2 &&
    Boolean(detail.didYouKnow?.trim())
  );
}

function buildMorningHero(row, date) {
  const collection = row.collections?.[0] ?? "museum_open_access";
  const year = resolveArtworkYear({
    year: row.year,
    artworkTitle: row.artwork_title,
    sourceUrl: row.source_url,
    tags: row.tags,
    aboutArtworkBody: row.about_artwork_body,
  });
  const teaser =
    row.about_artwork_body?.trim() ||
    buildHomepageTeaser({
      title: row.artwork_title,
      artist: row.artist,
      year,
      period: collection.replace(/_/g, " "),
      collection,
    });

  const detailFields = buildMasterpieceDetail({
    title: row.artwork_title,
    artist: row.artist,
    year,
    medium: "traditional materials",
    period: collection.replace(/_/g, " "),
    institution: row.source_institution,
    sourceUrl: row.source_url,
    collection,
    homepageTeaser: teaser,
  });

  const detail = detailFromFields(detailFields);
  if (!isDetailComplete(detail)) {
    throw new Error(`Detail synthesis failed for ${row.id}`);
  }

  return {
    editionDate: date,
    artworkId: row.id,
    artworkTitle: row.artwork_title.trim(),
    artist: row.artist.trim(),
    year,
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

async function checkDetailColumns() {
  const { error } = await admin
    .from("kindred_hero_artwork")
    .select("detail_editorial_status")
    .limit(1);
  return !error?.message?.includes("does not exist");
}

async function main() {
  const hasDetailColumns = await checkDetailColumns();
  if (!hasDetailColumns) {
    console.warn(
      "Migrations 0025/0026 not applied — detail columns missing. Repair will embed detail in edition JSON only."
    );
    console.warn(
      "Apply supabase/migrations/0025_hero_artwork_masterpiece_detail.sql and 0026_hero_artwork_editorial_sections.sql in the Supabase SQL editor."
    );
  }

  const { data: selection } = await admin
    .from("kindred_hero_artwork_edition_selections")
    .select("*")
    .eq("edition_date", editionDate)
    .maybeSingle();

  if (!selection?.artwork_id) {
    console.error(`No hero selection for ${editionDate}`);
    process.exit(1);
  }

  const { data: artwork, error: artworkError } = await admin
    .from("kindred_hero_artwork")
    .select("*")
    .eq("id", selection.artwork_id)
    .maybeSingle();

  if (artworkError || !artwork) {
    console.error("Artwork fetch failed:", artworkError?.message);
    process.exit(1);
  }

  const morningHero = buildMorningHero(artwork, editionDate);
  console.log("Repaired morning hero:", {
    editionDate,
    artworkId: morningHero.artworkId,
    title: morningHero.artworkTitle,
    detailSections: morningHero.detail.sections.length,
    lookCloser: morningHero.detail.lookingCloser.length,
  });

  if (dryRun) {
    console.log("Dry run — no writes.");
    return;
  }

  await admin
    .from("kindred_hero_artwork_edition_selections")
    .update({
      presentation_snapshot: morningHero,
      selected_at: new Date().toISOString(),
    })
    .eq("edition_date", editionDate);

  const { data: editions } = await admin
    .from("editions")
    .select("id, morning_edition")
    .eq("edition_date", editionDate);

  let patched = 0;
  for (const edition of editions ?? []) {
    const payload = edition.morning_edition;
    if (!payload || typeof payload !== "object") continue;
    const next = { ...payload, morningHero };
    const { error } = await admin
      .from("editions")
      .update({ morning_edition: next })
      .eq("id", edition.id);
    if (error) {
      console.error(`Edition ${edition.id} patch failed:`, error.message);
      continue;
    }
    patched++;
  }

  console.log(`Patched ${patched} edition row(s) for ${editionDate}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
