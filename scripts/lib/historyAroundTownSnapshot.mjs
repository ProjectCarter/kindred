/** Build frozen History Around Town snapshot — mirrors server snapshot.ts. */

import { isApprovedHistoryPlace } from "./historyPlaceValidation.mjs";

export const HISTORY_AROUND_TOWN_SUBTITLE =
  "Every town has a story waiting to be explored.";
export const HISTORY_AROUND_TOWN_CAROUSEL_LIMIT = 20;

function splitBody(body) {
  return body
    .trim()
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 20);
}

function resolveHistoricalMetadataLine(row) {
  const explicit = row.historical_metadata_line?.trim();
  if (explicit) return explicit;
  const year = row.year_established?.trim();
  if (year) {
    if (/^\d{4}s?$/.test(year)) return `Built in ${year.replace(/s$/, "")}`;
    if (/^since\s/i.test(year)) return year;
    if (/^established\s/i.test(year)) return year;
    if (/^from\s/i.test(year)) return year;
    return `Established in ${year}`;
  }
  const era = row.historical_era?.trim();
  return era || null;
}

function parseTimelineEntries(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const year = typeof entry.year === "string" ? entry.year.trim() : "";
      const event = typeof entry.event === "string" ? entry.event.trim() : "";
      if (!year || !event) return null;
      return { year, event };
    })
    .filter(Boolean);
}

function resolveNearbyLinks(slugs, slugIndex) {
  const out = [];
  const seen = new Set();
  for (const slug of slugs ?? []) {
    const key = slug?.trim();
    if (!key || seen.has(key)) continue;
    const row = slugIndex.get(key);
    if (!row) continue;
    seen.add(key);
    out.push({
      id: row.id,
      slug: row.slug,
      placeName: row.place_name.trim(),
      teaser: row.editorial_teaser.trim(),
      historicalMetadataLine: resolveHistoricalMetadataLine(row),
    });
  }
  return out;
}

export function rowToSnapshot(row, slugIndex) {
  if (!isApprovedHistoryPlace(row)) return null;

  const paragraphs = splitBody(row.story_body);
  if (paragraphs.length < 2) return null;

  const intro = row.editorial_introduction?.trim() || paragraphs[0] || null;
  const storyParagraphs = row.editorial_introduction?.trim()
    ? paragraphs
    : paragraphs.slice(1);
  if (!storyParagraphs.length) return null;

  const designations = [
    ...(row.historic_designations ?? []),
    ...(row.historic_designation?.trim() ? [row.historic_designation.trim()] : []),
  ]
    .map((d) => d.trim())
    .filter(Boolean)
    .filter((d, i, arr) => arr.indexOf(d) === i);

  const lookingCloser = (row.looking_closer ?? [])
    .map((item) => item.trim())
    .filter(Boolean);
  const architectureNote = row.architecture_note?.trim() ?? null;
  if (architectureNote && !lookingCloser.length) {
    lookingCloser.push(architectureNote);
  }

  return {
    id: row.id,
    slug: row.slug,
    placeName: row.place_name.trim(),
    category: row.category,
    categoryLabel: row.category_label?.trim() || row.category,
    teaser: row.editorial_teaser.trim(),
    historicalMetadataLine: resolveHistoricalMetadataLine(row),
    yearEstablished: row.year_established?.trim() ?? null,
    historicalEra: row.historical_era?.trim() ?? null,
    designations,
    editorialIntroduction: intro,
    theStory: storyParagraphs,
    whyItMatters: row.why_it_matters?.trim() ?? null,
    lookingCloser,
    timeline: parseTimelineEntries(row.timeline_entries),
    didYouKnow: (row.interesting_facts ?? []).map((f) => f.trim()).filter(Boolean),
    visitingToday: row.visiting_today_text?.trim() ?? null,
    beforeYouGo: row.before_you_go_text?.trim() ?? null,
    nearbyLinks: slugIndex
      ? resolveNearbyLinks(row.nearby_place_slugs, slugIndex)
      : [],
    closingNote: row.closing_note?.trim() ?? null,
    heroImageUrl: row.hosted_url?.trim() || row.image_url?.trim() || null,
    imageCredit: row.image_credit?.trim() ?? null,
    imageSourceUrl: row.image_source_url?.trim() ?? null,
    imageLicense: row.image_license?.trim() ?? null,
    imagePhotographer: row.image_photographer?.trim() ?? null,
    imageEra: row.image_era?.trim() ?? null,
    imageDate: row.image_date?.trim() ?? null,
    lat: row.lat,
    lon: row.lon,
    address: row.address?.trim() ?? null,
    city: row.city?.trim() ?? null,
    state: row.state?.trim() ?? null,
    phone: row.phone?.trim() ?? null,
    officialWebsite: row.official_website?.trim() ?? null,
    googleMapsUrl: row.google_maps_url?.trim() ?? null,
    admissionUrl: row.admission_url?.trim() ?? null,
    hoursText: row.hours_text?.trim() ?? null,
    admissionText: row.admission_text?.trim() ?? null,
    parkingText: row.parking_text?.trim() ?? null,
    accessibilityText: row.accessibility_text?.trim() ?? null,
    bestTimeToVisit: row.best_time_to_visit?.trim() ?? null,
    visitDuration: row.visit_duration_text?.trim() ?? null,
    dogPolicy: row.dog_policy_text?.trim() ?? null,
    body: paragraphs,
    modules: [],
    nearbyPlaces: (row.nearby_places ?? []).map((p) => p.trim()).filter(Boolean),
  };
}

function diversifyCarousel(rows) {
  const byCategory = new Map();
  for (const row of rows) {
    const list = byCategory.get(row.category) ?? [];
    list.push(row);
    byCategory.set(row.category, list);
  }

  const picked = [];
  const seen = new Set();
  const categories = [...byCategory.keys()];

  while (picked.length < HISTORY_AROUND_TOWN_CAROUSEL_LIMIT) {
    let added = false;
    for (const cat of categories) {
      const pool = byCategory.get(cat) ?? [];
      const next = pool.find((r) => !seen.has(r.id));
      if (!next) continue;
      picked.push(next);
      seen.add(next.id);
      added = true;
      if (picked.length >= HISTORY_AROUND_TOWN_CAROUSEL_LIMIT) break;
    }
    if (!added) break;
  }

  if (picked.length < HISTORY_AROUND_TOWN_CAROUSEL_LIMIT) {
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      picked.push(row);
      seen.add(row.id);
      if (picked.length >= HISTORY_AROUND_TOWN_CAROUSEL_LIMIT) break;
    }
  }

  return picked;
}

export function metroKeyFromLocation(location) {
  const city = location.city?.trim();
  if (!city) return "";
  const state = location.state?.trim() || location.region?.trim() || "";
  return `${city}-${state}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function buildHistoryAroundTownSnapshot(rows, metroKey) {
  if (!rows.length) return null;

  const slugIndex = new Map(rows.map((row) => [row.slug, row]));
  const carouselRows = diversifyCarousel(rows);
  const places = rows
    .map((row) => rowToSnapshot(row, slugIndex))
    .filter((p) => p != null);
  const carousel = carouselRows
    .map((row) => rowToSnapshot(row, slugIndex))
    .filter((p) => p != null);

  if (!carousel.length || !places.length) return null;

  return {
    metroKey,
    subtitle: HISTORY_AROUND_TOWN_SUBTITLE,
    carousel,
    places,
  };
}
