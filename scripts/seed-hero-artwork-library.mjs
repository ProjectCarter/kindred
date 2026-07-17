/**
 * Seed the permanent Hero Artwork Library from Wikimedia Commons.
 * (Met Open Access is preferred when available; falls back to Commons.)
 *
 * Each artwork is downloaded, hosted in kindred-hero-artwork, and inserted
 * with a curator-style editorial description before it can ever be selected.
 *
 * Usage:
 *   node scripts/seed-hero-artwork-library.mjs
 *   node scripts/seed-hero-artwork-library.mjs --target 400
 *   node scripts/seed-hero-artwork-library.mjs --dry-run --limit 5
 */
import { createClient } from "@supabase/supabase-js";
import { buildMasterpieceCreditLine } from "./lib/masterpieceCredit.mjs";
import { buildMasterpieceDetail, buildHomepageTeaser } from "./lib/masterpieceDetail.mjs";
import {
  sanitizeArtworkTitle,
  sanitizeArtistName,
  sanitizeArtworkYear,
  parseArtworkYearFromText,
} from "./lib/sanitizeWikimediaMetadata.mjs";

const SUPABASE_URL = "https://zdqjeocdsbdzecawumdp.supabase.co";
const SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI3ODM1MCwiZXhwIjoyMDk4ODU0MzUwfQ.FwAqKj2kD7OOfYrePX2ahBSt3UFO4n2YjpFgPU-VUWk";

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const MET_API = "https://collectionapi.metmuseum.org/public/collection/v1";
const HERO_BUCKET = "kindred-hero-artwork";
const USER_AGENT = "Kindred/1.0 (hero-artwork-library-seed)";
const ABOUT_SENTENCE_MIN = 1;
const ABOUT_SENTENCE_MAX = 2;
const ABOUT_WORD_MIN = 35;
const ABOUT_WORD_MAX = 60;

const CONCURRENCY = 4;
const PER_QUERY_PAGE_LIMIT = 12;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const targetTotal = Number(
  args.find((a) => a.startsWith("--target="))?.split("=")[1] ??
    args[args.indexOf("--target") + 1] ??
    400
);
const hardLimit = Number(
  args.find((a) => a.startsWith("--limit="))?.split("=")[1] ??
    args[args.indexOf("--limit") + 1] ??
    0
);

/** Curated collection quotas — spans styles, periods, and illustration. */
const SEED_PLAN = [
  {
    collection: "impressionism",
    quota: 50,
    queries: [
      "Claude Monet painting landscape",
      "Pierre-Auguste Renoir painting",
      "Impressionist painting public domain",
      "Edgar Degas painting",
    ],
  },
  {
    collection: "dutch_masters",
    quota: 45,
    queries: [
      "Johannes Vermeer painting",
      "Rembrandt van Rijn painting",
      "Dutch Golden Age painting",
    ],
  },
  {
    collection: "renaissance",
    quota: 40,
    queries: [
      "Renaissance painting public domain",
      "Italian Renaissance altarpiece painting",
      "Raphael painting",
    ],
  },
  {
    collection: "baroque",
    quota: 35,
    queries: ["Baroque painting public domain", "Caravaggio painting"],
  },
  {
    collection: "ukiyo_e",
    quota: 40,
    queries: [
      "Hokusai woodblock print",
      "Hiroshige woodblock print ukiyo-e",
      "Japanese ukiyo-e print",
    ],
  },
  {
    collection: "american_realism",
    quota: 35,
    queries: [
      "Edward Hopper painting",
      "Winslow Homer painting",
      "Mary Cassatt painting",
    ],
  },
  {
    collection: "romanticism",
    quota: 30,
    queries: [
      "J.M.W. Turner landscape painting",
      "Romantic landscape painting 19th century",
    ],
  },
  {
    collection: "art_nouveau",
    quota: 25,
    queries: [
      "Alphonse Mucha poster art nouveau",
      "Art Nouveau illustration poster",
    ],
  },
  {
    collection: "botanical_illustration",
    quota: 30,
    queries: [
      "botanical illustration 19th century",
      "flower botanical print scientific",
    ],
  },
  {
    collection: "historic_engravings",
    quota: 25,
    queries: [
      "historic engraving city view",
      "architectural engraving 18th century",
    ],
  },
  {
    collection: "vintage_travel_posters",
    quota: 25,
    queries: [
      "vintage travel poster railway",
      "retro travel poster landscape",
    ],
  },
  {
    collection: "nasa",
    quota: 20,
    queries: [
      "NASA public domain space photograph",
      "Hubble telescope image public domain",
    ],
  },
  {
    collection: "museum_open_access",
    quota: 30,
    queries: [
      "museum painting public domain masterpiece",
      "open access fine art painting",
    ],
  },
];

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function stripHtml(html) {
  return String(html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function metaValue(info, key) {
  return stripHtml(info?.extmetadata?.[key]?.value ?? "");
}

function isCommerciallyUsableLicense(licenseName) {
  const license = licenseName.trim().toLowerCase();
  if (!license) return false;
  if (/non.?commercial|\bnc\b|no derivatives|\bnd\b|all rights reserved/i.test(license)) {
    return false;
  }
  return /public domain|cc0|cc zero|cc by\b|cc-by\b|government/i.test(license);
}

function normalizeLicense(shortName) {
  const lower = shortName.toLowerCase();
  if (/public domain|pd-/i.test(lower)) return "public_domain";
  if (/cc0|cc zero/i.test(lower)) return "cc0";
  if (/government/i.test(lower)) return "government_work";
  return "public_domain";
}

function parseArtist(raw, filePageTitle) {
  return sanitizeArtistName(raw, filePageTitle);
}

function parseTitle(candidate) {
  const filePageTitle = candidate.sourcePageUrl?.includes("commons.wikimedia.org")
    ? `File:${decodeURIComponent(candidate.sourcePageUrl.split("/wiki/").pop() ?? "").replace(/_/g, " ")}`
    : null;
  return sanitizeArtworkTitle(candidate.altDescription || candidate.objectName, {
    objectName: candidate.objectName,
    filePageTitle,
  });
}

function parseYear(candidate) {
  return (
    sanitizeArtworkYear(null, {
      title: candidate.altDescription,
      imageDescription: candidate.altDescription,
      filePageTitle: candidate.sourcePageUrl,
    }) ?? parseArtworkYearFromText(candidate.objectName ?? candidate.altDescription)
  );
}

function countSentences(text) {
  return text
    .trim()
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8).length;
}

function validateAboutBody(body) {
  const wordCount = countWords(body);
  const sentenceCount = countSentences(body);
  return (
    sentenceCount >= ABOUT_SENTENCE_MIN &&
    sentenceCount <= ABOUT_SENTENCE_MAX &&
    wordCount >= ABOUT_WORD_MIN &&
    wordCount <= ABOUT_WORD_MAX
  );
}

function computeDisplayDimensions(sourceWidth, sourceHeight) {
  const target = Math.min(1600, Math.max(1200, Math.min(1400, sourceWidth)));
  const aspectRatio = sourceWidth / sourceHeight;
  return {
    imageWidth: target,
    imageHeight: Math.max(1, Math.round(target / aspectRatio)),
    aspectRatio: Number(aspectRatio.toFixed(6)),
  };
}

function buildAboutBody(input) {
  const { title, artist, year, period, collection } = input;
  const body = buildHomepageTeaser({
    title,
    artist,
    year,
    period,
    collection,
  });

  if (validateAboutBody(body)) return body.trim();

  const fallback =
    `${title}${year ? ` (${year})` : ""} holds a detail most people walk past — until ${artist} makes you see it. ` +
    `It is the kind of work that makes you want to know what happened next.`;
  return fallback.trim();
}

async function searchWikimedia(query, offset = 0) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrnamespace: "6",
    gsrsearch: `filetype:bitmap ${query}`,
    gsrlimit: "50",
    gsroffset: String(offset),
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    iiurlwidth: "1400",
    iiextmetadatalanguage: "en",
  });

  const res = await fetch(`${COMMONS_API}?${params}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) return { candidates: [], nextOffset: null };
  const data = await res.json();
  const pages = Object.values(data.query?.pages ?? {});
  const candidates = [];

  for (const page of pages) {
    const info = page.imageinfo?.[0];
    const fullWidth = info?.width ?? 0;
    const fullHeight = info?.height ?? 0;
    const thumbWidth = info?.thumbwidth ?? fullWidth;
    const thumbHeight = info?.thumbheight ?? fullHeight;
    if (fullWidth < 800 || fullHeight < 500) continue;
    if (!/^image\/(jpeg|png|webp)$/i.test(info?.mime ?? "")) continue;
    if (fullWidth <= fullHeight) continue;

    const licenseShortName = metaValue(info, "LicenseShortName");
    if (!isCommerciallyUsableLicense(licenseShortName)) continue;

    const title = page.title ?? "";
    const sourcePageUrl = title
      ? `https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`
      : "https://commons.wikimedia.org/";

    const downloadUrl = info?.thumburl || info?.url || "";
    if (!downloadUrl) continue;

    candidates.push({
      providerImageId: String(page.pageid ?? title),
      downloadUrl,
      photographerName: metaValue(info, "Artist") || metaValue(info, "Credit"),
      altDescription: metaValue(info, "ImageDescription") || title.replace(/^File:/i, ""),
      objectName: metaValue(info, "ObjectName"),
      medium: metaValue(info, "Medium"),
      sourcePageUrl,
      licenseShortName,
      licenseUrl: metaValue(info, "LicenseUrl"),
      width: thumbWidth,
      height: thumbHeight,
    });
  }

  const nextOffset = data.continue?.gsroffset ?? null;
  return { candidates, nextOffset };
}

async function existsProviderId(provider, providerArtworkId) {
  const { data } = await admin
    .from("kindred_hero_artwork")
    .select("id")
    .eq("source_provider", provider)
    .eq("source_provider_artwork_id", providerArtworkId)
    .maybeSingle();
  return Boolean(data?.id);
}

async function hostImage(provider, providerId, downloadUrl, sourceWidth, sourceHeight) {
  const res = await fetch(downloadUrl, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) return null;

  const mime = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "image/jpeg";
  if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) return null;

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (!bytes.length || bytes.length > 4 * 1024 * 1024) return null;

  const dims = computeDisplayDimensions(sourceWidth, sourceHeight);
  const ext = mime === "image/webp" ? "webp" : mime === "image/png" ? "png" : "jpg";
  const storagePath = `${provider}/${providerId}.${ext}`;

  if (dryRun) {
    return {
      hostedUrl: `${SUPABASE_URL}/storage/v1/object/public/${HERO_BUCKET}/${storagePath}`,
      storagePath,
      ...dims,
    };
  }

  const { error } = await admin.storage.from(HERO_BUCKET).upload(storagePath, bytes, {
    contentType: mime,
    upsert: true,
  });
  if (error) return null;

  const { data } = admin.storage.from(HERO_BUCKET).getPublicUrl(storagePath);
  return { hostedUrl: data.publicUrl, storagePath, ...dims };
}

async function upsertWikimediaArtwork(candidate, collection, hosted) {
  const providerId = candidate.providerImageId;
  const artist = parseArtist(candidate.photographerName, candidate.sourcePageUrl);
  const title = parseTitle(candidate);
  const year = parseYear(candidate);
  const aboutBody = buildAboutBody({
    title,
    artist,
    year,
    period: collection.replace(/_/g, " "),
    collection,
  });
  const wordCount = countWords(aboutBody);
  if (!validateAboutBody(aboutBody)) return false;

  const creditLine = buildMasterpieceCreditLine({
    artist,
    license: normalizeLicense(candidate.licenseShortName),
    sourceInstitution: "Wikimedia Commons",
    sourceProvider: "wikimedia",
    mediumHint: candidate.medium || candidate.altDescription,
    collections: [collection, "museum_open_access"],
    tags: candidate.objectName ? [candidate.objectName] : [],
  });

  const row = {
    internal_id: `kindred:hero:wikimedia:${providerId}`,
    artwork_title: title,
    artist,
    year,
    source_institution: "Wikimedia Commons",
    source_url: candidate.sourcePageUrl,
    image_url: hosted.hostedUrl,
    hosted_url: hosted.hostedUrl,
    storage_path: hosted.storagePath,
    image_width: hosted.imageWidth,
    image_height: hosted.imageHeight,
    aspect_ratio: hosted.aspectRatio,
    orientation: "landscape",
    dominant_colors: [],
    collections: [collection, "museum_open_access"],
    mood_tags: [],
    tags: candidate.objectName ? [candidate.objectName] : [],
    seasons: ["spring", "summer", "autumn", "winter"],
    holidays: [],
    license: normalizeLicense(candidate.licenseShortName),
    license_url: candidate.licenseUrl || null,
    public_domain_status: "verified",
    verification_source: "Wikimedia Commons API",
    commercial_use_confirmed: true,
    attribution_text: creditLine,
    attribution_required: true,
    verified_at: new Date().toISOString(),
    verified_by: "kindred:seed-library",
    source_provider: "wikimedia",
    source_provider_artwork_id: providerId,
    about_artwork_body: aboutBody,
    about_word_count: wordCount,
    ...buildMasterpieceDetail({
      title,
      artist,
      year,
      medium: candidate.medium || "traditional materials",
      period: collection.replace(/_/g, " "),
      institution: "Wikimedia Commons",
      sourceUrl: candidate.sourcePageUrl,
      collection,
      homepageTeaser: aboutBody,
    }),
    curator_editorial_status: "approved",
    featured: false,
    editorial_priority: 75,
    approval_status: "approved",
  };

  if (dryRun) {
    console.log("  dry-run", title, "by", artist);
    return true;
  }

  const { error } = await admin
    .from("kindred_hero_artwork")
    .upsert(row, { onConflict: "internal_id" });
  if (error) {
    console.warn("  upsert failed", providerId, error.message);
    return false;
  }
  return true;
}

async function tryMetTopUp(remaining) {
  if (remaining <= 0) return 0;
  let added = 0;
  try {
    const res = await fetch(
      `${MET_API}/search?hasImages=true&isPublicDomain=true&departmentId=11`
    );
    if (!res.ok) return 0;
    const search = await res.json();
    for (const objectId of (search.objectIDs ?? []).slice(0, remaining * 3)) {
      if (added >= remaining) break;
      if (await existsProviderId("met", String(objectId))) continue;
      const objRes = await fetch(`${MET_API}/objects/${objectId}`);
      if (!objRes.ok) continue;
      const obj = await objRes.json();
      if (!obj?.primaryImage) continue;
      const hosted = await hostImage("met", objectId, obj.primaryImage);
      if (!hosted) continue;
      // Minimal Met row — same shape as wikimedia
      const title = obj.title?.trim() || "Untitled";
      const artist = obj.artistDisplayName?.trim() || "Unknown artist";
      const aboutBody = buildAboutBody({
        title,
        artist,
        year: parseYear(obj.objectDate),
        period: obj.period || "its era",
        collection: "impressionism",
      });
      const row = {
        internal_id: `kindred:hero:met:${objectId}`,
        artwork_title: title,
        artist,
        year: parseYear(obj.objectDate),
        source_institution: "The Metropolitan Museum of Art",
        source_url: obj.objectURL ?? "https://www.metmuseum.org/",
        image_url: hosted.hostedUrl,
        hosted_url: hosted.hostedUrl,
        storage_path: hosted.storagePath,
        orientation: "landscape",
        dominant_colors: [],
        collections: ["museum_open_access", "impressionism"],
        mood_tags: [],
        tags: [],
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
          collections: ["museum_open_access", "impressionism"],
        }),
        attribution_required: true,
        verified_at: new Date().toISOString(),
        verified_by: "kindred:seed-library",
        source_provider: "met",
        source_provider_artwork_id: String(objectId),
        about_artwork_body: aboutBody,
        about_word_count: countWords(aboutBody),
        ...buildMasterpieceDetail({
          title,
          artist,
          year: parseYear(obj.objectDate),
          medium: obj.medium || "traditional materials",
          period: obj.period || "its era",
          institution: "The Metropolitan Museum of Art",
          sourceUrl: obj.objectURL ?? "https://www.metmuseum.org/",
          collection: "impressionism",
          homepageTeaser: aboutBody,
        }),
        curator_editorial_status: "approved",
        featured: false,
        editorial_priority: 80,
        approval_status: "approved",
      };
      if (!dryRun) {
        const { error } = await admin
          .from("kindred_hero_artwork")
          .upsert(row, { onConflict: "internal_id" });
        if (error) continue;
      }
      added += 1;
      await sleep(150);
    }
  } catch {
    // Met optional top-up
  }
  return added;
}

async function ingestCandidate(candidate, collection) {
  if (await existsProviderId("wikimedia", candidate.providerImageId)) {
    return "exists";
  }
  const hosted = await hostImage(
    "wikimedia",
    candidate.providerImageId,
    candidate.downloadUrl,
    candidate.width,
    candidate.height
  );
  if (!hosted) return "host-failed";
  const ok = await upsertWikimediaArtwork(candidate, collection, hosted);
  return ok ? "added" : "upsert-failed";
}

async function ingestBatch(candidates, collection) {
  const results = await Promise.all(
    candidates.map((c) => ingestCandidate(c, collection))
  );
  return results.filter((r) => r === "added").length;
}

async function main() {
  const { count: existingCount } = await admin
    .from("kindred_hero_artwork")
    .select("*", { count: "exact", head: true });

  console.log("Existing library size:", existingCount ?? 0);
  console.log("Target total:", targetTotal, dryRun ? "(dry-run)" : "");

  let added = 0;
  let scanned = 0;
  const scale =
    targetTotal / SEED_PLAN.reduce((sum, p) => sum + p.quota, 0);

  for (const plan of SEED_PLAN) {
    if ((existingCount ?? 0) + added >= targetTotal) break;
    if (hardLimit && added >= hardLimit) break;

    const quota = Math.max(8, Math.round(plan.quota * scale));
    console.log(`\nCollection ${plan.collection} (quota ${quota})`);
    let collectionAdded = 0;

    for (const query of plan.queries) {
      if (collectionAdded >= quota) break;
      if ((existingCount ?? 0) + added >= targetTotal) break;

      let offset = 0;
      let pages = 0;
      while (collectionAdded < quota && pages < PER_QUERY_PAGE_LIMIT) {
        if ((existingCount ?? 0) + added >= targetTotal) break;
        if (hardLimit && added >= hardLimit) break;

        const { candidates, nextOffset } = await searchWikimedia(query, offset);
        if (!candidates.length) break;

        for (let i = 0; i < candidates.length; i += CONCURRENCY) {
          if (collectionAdded >= quota) break;
          const batch = candidates.slice(i, i + CONCURRENCY);
          scanned += batch.length;
          const batchAdded = await ingestBatch(batch, plan.collection);
          added += batchAdded;
          collectionAdded += batchAdded;
          if (added > 0 && added % 25 === 0) {
            console.log(`  progress: ${added} added (${scanned} scanned)`);
          }
          await sleep(100);
        }

        if (nextOffset == null) break;
        offset = nextOffset;
        pages += 1;
        await sleep(150);
      }
    }
    console.log(`  collection done: +${collectionAdded}`);
  }

  const remaining = Math.max(0, targetTotal - ((existingCount ?? 0) + added));
  if (remaining > 0 && !hardLimit) {
    const metAdded = await tryMetTopUp(Math.min(remaining, 50));
    added += metAdded;
    if (metAdded) console.log(`Met top-up: +${metAdded}`);
  }

  const { count: finalCount } = await admin
    .from("kindred_hero_artwork")
    .select("*", { count: "exact", head: true });

  console.log("\nSeed complete", {
    added,
    scanned,
    librarySize: finalCount ?? 0,
    dryRun,
  });

  if (!dryRun && (finalCount ?? 0) < 100) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
