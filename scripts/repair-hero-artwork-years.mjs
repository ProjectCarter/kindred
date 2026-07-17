/**
 * Repair artwork years corrupted by Wikidata P#### property numbers (e.g. QS:P1476 → 1476).
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/repair-hero-artwork-years.mjs
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/repair-hero-artwork-years.mjs --dry-run
 */
import { createClient } from "@supabase/supabase-js";
import {
  parseArtworkYearFromText,
  stripWikidataMarkup,
} from "./lib/sanitizeWikimediaMetadata.mjs";
import { resolveArtworkYear } from "./lib/resolveArtworkYear.mjs";

const dryRun = process.argv.includes("--dry-run");
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const USER_AGENT = "Kindred/1.0 (hero-artwork-year-repair)";

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

function fileTitleFromSourceUrl(sourceUrl) {
  if (!sourceUrl?.includes("commons.wikimedia.org/wiki/File:")) return null;
  const encoded = sourceUrl.split("/wiki/File:")[1]?.split("#")[0];
  if (!encoded) return null;
  return decodeURIComponent(encoded.replace(/_/g, " "));
}

function yearFromWikidataPropertyTrap(originalTitle, storedYear) {
  if (!storedYear?.trim() || !originalTitle) return false;
  const prop = originalTitle.match(/QS:P(\d+)/i);
  return Boolean(prop && prop[1] === storedYear.trim());
}

async function fetchCommonsYear(fileTitle) {
  if (!fileTitle) return null;
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "imageinfo",
    titles: `File:${fileTitle}`,
    iiprop: "extmetadata",
  });
  const res = await fetch(`${COMMONS_API}?${params}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) return null;
  const json = await res.json();
  const pages = json.query?.pages ?? {};
  const page = Object.values(pages)[0];
  const meta = page?.imageinfo?.[0]?.extmetadata ?? {};
  const candidates = [
    meta.DateTimeOriginal?.value,
    meta.Date?.value,
    meta.ArtworkDate?.value,
    meta.ImageDescription?.value,
    meta.ObjectName?.value,
  ]
    .map((v) => stripWikidataMarkup(String(v ?? "")))
    .filter(Boolean);

  for (const text of candidates) {
    const year = parseArtworkYearFromText(text);
    if (year && !yearFromWikidataPropertyTrap(text, year)) return year;
  }
  return null;
}

const KNOWN_YEARS = {
  "Scuola di Atene": "1509–1511",
  "神奈川沖浪裏": "c. 1831",
  "The Great Wave off Kanagawa": "c. 1831",
  "Stream in the Liebethaler Grund": "c. 1827",
  "Les baigneuses": "c. 1895",
  "Macbeth": "1867",
  "Die beiden Ufer": "1881",
  "Poplars at the Epte": "1891",
  "Seine bei Argenteuil": "1872",
  "Le Chemin creux": "1882",
  "Bewachsener Hang": "1882",
  "The Parc Monceau": "1876",
  "The Wine Glass": "c. 1858",
  "Coastal landscape": "c. 1869",
  "Christ Taking Leave of the Apostles": "c. 1520",
  "The Centurion Cornelius": "c. 1655",
  "Maestà (Madonna with Angels and Saints)": "1311",
  "Office at Night": "1940",
  "Felsen im Plauenschen Grund": "c. 1823",
  "Mountain Landscape with a Farm": "1823",
  "Shipwreck": "1832",
};

async function main() {
  const { data: rows, error } = await admin.from("kindred_hero_artwork").select("*");
  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  let updated = 0;
  for (const row of rows ?? []) {
    const fileTitle = fileTitleFromSourceUrl(row.source_url);
    let nextYear = row.year?.trim() ?? null;

    if (nextYear === "1476" || yearFromWikidataPropertyTrap(row.artwork_title, nextYear)) {
      nextYear = null;
    }

    if (!nextYear || yearFromWikidataPropertyTrap(row.source_url, nextYear)) {
      const commonsYear = await fetchCommonsYear(fileTitle);
      nextYear =
        commonsYear ??
        KNOWN_YEARS[row.artwork_title?.trim()] ??
        resolveArtworkYear({
          year: null,
          artworkTitle: row.artwork_title,
          sourceUrl: row.source_url,
          tags: row.tags,
          aboutArtworkBody: row.about_artwork_body,
        });
    }

    const shouldClearBad = row.year === "1476" && (!nextYear || nextYear === "1476");
    if (shouldClearBad) nextYear = null;

    if (nextYear === row.year) continue;

    console.log("year", {
      id: row.id,
      title: row.artwork_title?.slice(0, 40),
      before: row.year,
      after: nextYear,
    });

    if (!dryRun) {
      const { error: updateError } = await admin
        .from("kindred_hero_artwork")
        .update({ year: nextYear })
        .eq("id", row.id);
      if (updateError) {
        console.error("  failed:", updateError.message);
        continue;
      }
    }
    updated++;
  }

  console.log(JSON.stringify({ updated, dryRun }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
