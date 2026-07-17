/**
 * Seed a small batch of Met Open Access masterpieces with full stored detail.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-masterpiece-met-batch.mjs --count 8
 */
import { createClient } from "@supabase/supabase-js";
import { buildMasterpieceCreditLine } from "./lib/masterpieceCredit.mjs";
import { buildMasterpieceDetail, buildHomepageTeaser } from "./lib/masterpieceDetail.mjs";
import { validateDetailFields } from "./lib/masterpieceDetail.mjs";

const MET_API = "https://collectionapi.metmuseum.org/public/collection/v1";
const HERO_BUCKET = "kindred-hero-artwork";

const args = process.argv.slice(2);
const count = Number(
  args.find((a) => a.startsWith("--count="))?.split("=")[1] ??
    args[args.indexOf("--count") + 1] ??
    8
);
const dryRun = args.includes("--dry-run");

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

/** Diverse Met object IDs — paintings, periods, cultures (public domain). */
const MET_OBJECT_IDS = [
  436121, // Washington Crossing the Delaware
  437133, // Wheat Field with Cypresses (Van Gogh)
  459123, // Self-Portrait with a Straw Hat (Van Gogh)
  437980, // The Dance Class (Degas)
  436535, // The Harvesters (Bruegel)
  437329, // Portrait of a Woman (Vermeer)
  438817, // Aristotle with a Bust of Homer (Rembrandt)
  436105, // Venus and the Lute Player (Titian)
  436838, // The Love Song (Burne-Jones)
  437853, // Still Life with Apples and Pears (Cézanne)
  436965, // The Gulf Stream (Homer)
  438754, // The Card Players (Cézanne)
];

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function parseYear(objectDate) {
  if (!objectDate?.trim()) return null;
  const range = objectDate.match(/(1[0-9]{3}|20[0-1][0-9])\s*[–-]\s*(1[0-9]{3}|20[0-1][0-9])/);
  if (range) return `${range[1]}–${range[2]}`;
  const single = objectDate.match(/(1[0-9]{3}|20[0-1][0-9])/);
  return single?.[1] ?? null;
}

function inferCollection(obj) {
  const period = (obj.period ?? obj.culture ?? "").toLowerCase();
  if (/impressionist|post-impressionist|monet|renoir|degas|sisley/.test(period + obj.artistDisplayName)) {
    return "impressionism";
  }
  if (/dutch|vermeer|rembrandt/.test(period + obj.artistDisplayName)) {
    return "dutch_masters";
  }
  if (/renaissance|italian|raphael|titian/.test(period + obj.artistDisplayName)) {
    return "renaissance";
  }
  if (/baroque|caravaggio/.test(period + obj.artistDisplayName)) {
    return "baroque";
  }
  if (/american|hopper|homer|cassatt/.test(period + obj.artistDisplayName)) {
    return "american_realism";
  }
  return "museum_open_access";
}

async function existsMetId(objectId) {
  const { count } = await admin
    .from("kindred_hero_artwork")
    .select("*", { count: "exact", head: true })
    .eq("source_provider", "met")
    .eq("source_provider_artwork_id", String(objectId));
  return (count ?? 0) > 0;
}

async function hostImage(objectId, imageUrl) {
  const res = await fetch(imageUrl);
  if (!res.ok) return null;
  const buffer = Buffer.from(await res.arrayBuffer());
  const storagePath = `met/${objectId}.jpg`;
  const { error } = await admin.storage.from(HERO_BUCKET).upload(storagePath, buffer, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) return null;
  return {
    storagePath,
    hostedUrl: `${url}/storage/v1/object/public/${HERO_BUCKET}/${storagePath}`,
  };
}

function computeValidation(row, detail) {
  const detailOk = validateDetailFields({
    long_story_body: detail.long_story_body,
    artist_biography: detail.artist_biography,
    look_closer_items: detail.look_closer_items,
    did_you_know: detail.did_you_know,
    museum_name: detail.museum_name,
    museum_location: detail.museum_location,
    official_artwork_url: detail.official_artwork_url,
    official_museum_url: detail.official_museum_url,
    editorial_sections: detail.editorial_sections,
  });
  return detailOk && row.year?.trim() ? "approved" : "needs_review";
}

async function ingestMetObject(objectId) {
  if (await existsMetId(objectId)) return "exists";

  const objRes = await fetch(`${MET_API}/objects/${objectId}`);
  if (!objRes.ok) return "fetch-failed";
  const obj = await objRes.json();
  if (!obj?.primaryImage || !obj.isPublicDomain) return "not-public-domain";

  const hosted = await hostImage(objectId, obj.primaryImage);
  if (!hosted) return "host-failed";

  const title = obj.title?.trim() || "Untitled";
  const artist = obj.artistDisplayName?.trim() || "Unknown artist";
  const year = parseYear(obj.objectDate);
  if (!year) return "missing-year";

  const collection = inferCollection(obj);
  const teaser = buildHomepageTeaser({
    title,
    artist,
    year,
    period: obj.period || collection.replace(/_/g, " "),
    collection,
  });
  const detail = buildMasterpieceDetail({
    title,
    artist,
    year,
    medium: obj.medium || "Oil on canvas",
    period: obj.period || collection.replace(/_/g, " "),
    institution: "The Metropolitan Museum of Art",
    sourceUrl: obj.objectURL ?? "https://www.metmuseum.org/",
    collection,
    homepageTeaser: teaser,
  });

  const row = {
    internal_id: `kindred:hero:met:${objectId}`,
    artwork_title: title,
    artist,
    year,
    source_institution: "The Metropolitan Museum of Art",
    source_url: obj.objectURL ?? "https://www.metmuseum.org/",
    image_url: hosted.hostedUrl,
    hosted_url: hosted.hostedUrl,
    storage_path: hosted.storagePath,
    orientation: "landscape",
    dominant_colors: [],
    collections: ["museum_open_access", collection],
    mood_tags: [],
    tags: [obj.classification, obj.culture].filter(Boolean),
    seasons: ["spring", "summer", "autumn", "winter"],
    holidays: [],
    license: "museum_open_access",
    license_url: "https://www.metmuseum.org/about-the-met/policies-and-documents/open-access",
    public_domain_status: "verified",
    verification_source: "Met Museum Open Access API",
    commercial_use_confirmed: true,
    attribution_text: buildMasterpieceCreditLine({
      artist,
      license: "museum_open_access",
      sourceInstitution: "The Metropolitan Museum of Art",
      sourceProvider: "met",
      mediumHint: obj.medium,
      collections: ["museum_open_access", collection],
    }),
    attribution_required: true,
    verified_at: new Date().toISOString(),
    verified_by: "kindred:seed-met-batch",
    source_provider: "met",
    source_provider_artwork_id: String(objectId),
    about_artwork_body: teaser,
    about_word_count: countWords(teaser),
    ...detail,
    curator_editorial_status: "approved",
    featured: false,
    editorial_priority: 85,
    approval_status: "approved",
    validation_status: "needs_review",
  };

  row.validation_status = computeValidation(row, detail);

  if (dryRun) {
    console.log("dry-run", title, year, row.validation_status);
    return row.validation_status === "approved" ? "added" : "needs-review";
  }

  const { error } = await admin.from("kindred_hero_artwork").upsert(row, {
    onConflict: "internal_id",
  });
  if (error) {
    console.warn(objectId, error.message);
    return "upsert-failed";
  }
  console.log("added", title, "by", artist, `(${year})`, row.validation_status);
  return row.validation_status === "approved" ? "added" : "needs-review";
}

async function main() {
  let added = 0;
  let rejected = 0;

  for (const objectId of MET_OBJECT_IDS) {
    if (added >= count) break;
    const result = await ingestMetObject(objectId);
    if (result === "added") added++;
    else if (result === "needs-review") rejected++;
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(JSON.stringify({ added, rejected, target: count, dryRun }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
