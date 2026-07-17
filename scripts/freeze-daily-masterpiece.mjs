/**
 * Freeze Today's Masterpiece for an edition date when no selection row exists yet.
 * Reuses library rotation (recent 14 days) and the same morningHero snapshot shape
 * as edition build + repair-masterpiece-editions.mjs.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/freeze-daily-masterpiece.mjs
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/freeze-daily-masterpiece.mjs --edition-date=2026-07-17
 *   node scripts/freeze-daily-masterpiece.mjs --dry-run
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

function isReadyLibraryRow(row) {
  return (
    row.approval_status === "approved" &&
    row.public_domain_status === "verified" &&
    row.hosted_url?.trim() &&
    row.about_artwork_body?.trim() &&
    row.artwork_title?.trim() &&
    row.artist?.trim()
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

function daySeed(date) {
  const [y, m, d] = date.split("-").map(Number);
  return y * 372 + m * 31 + d;
}

async function pickArtworkForDate(date) {
  const { data: recent } = await admin
    .from("kindred_hero_artwork_edition_selections")
    .select("artwork_id")
    .order("edition_date", { ascending: false })
    .limit(14);

  const recentIds = new Set((recent ?? []).map((r) => r.artwork_id));

  const { data: library, error } = await admin
    .from("kindred_hero_artwork")
    .select("*")
    .eq("approval_status", "approved")
    .eq("public_domain_status", "verified")
    .not("hosted_url", "is", null)
    .order("editorial_priority", { ascending: false })
    .order("featured", { ascending: false });

  if (error) throw new Error(error.message);

  const eligible = (library ?? []).filter(isReadyLibraryRow);
  if (eligible.length === 0) {
    throw new Error("No eligible approved hero artwork in library");
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
    morningHero = buildMorningHero(artwork, editionDate);
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

    await admin
      .from("kindred_hero_artwork")
      .update({
        last_used_at: new Date().toISOString(),
      })
      .eq("id", artworkId);

    console.log("Created frozen selection row.");
  } else if (!existing.presentation_snapshot?.hostedUrl) {
    await admin
      .from("kindred_hero_artwork_edition_selections")
      .update({
        presentation_snapshot: morningHero,
        selected_at: new Date().toISOString(),
      })
      .eq("edition_date", editionDate);
    console.log("Repaired empty presentation_snapshot.");
  }

  const { data: editions } = await admin
    .from("editions")
    .select("id, morning_edition")
    .eq("edition_date", editionDate);

  let patched = 0;
  for (const edition of editions ?? []) {
    const payload = edition.morning_edition;
    if (!payload || typeof payload !== "object") continue;
    const current = payload.morningHero;
    if (current?.artworkId === morningHero.artworkId && current?.hostedUrl) {
      continue;
    }
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

  console.log(`Done. Patched ${patched} edition row(s) for ${editionDate}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
