/** Build frozen History Around Town snapshot — mirrors server library.ts. */

import { isApprovedHistoryPlace } from "./historyPlaceValidation.mjs";

export const HISTORY_AROUND_TOWN_SUBTITLE =
  "Every town has a story waiting to be explored.";
export const HISTORY_AROUND_TOWN_CAROUSEL_LIMIT = 20;

export const CATEGORY_LABELS = {
  historic_district: "Historic district",
  historic_home: "Historic home",
  museum: "Museum",
  monument: "Monument",
  memorial: "Memorial",
  courthouse: "Courthouse",
  church: "Historic church",
  school: "Historic school",
  train_depot: "Train depot",
  bridge: "Historic bridge",
  military_site: "Military site",
  archaeological_site: "Archaeological site",
  historic_cemetery: "Historic cemetery",
  neighborhood: "Historic neighborhood",
  observatory: "Observatory",
  lighthouse: "Lighthouse",
  public_art: "Public art",
  landmark: "Historic landmark",
};

function splitBody(body) {
  return body
    .trim()
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 20);
}

function modulesFromRow(row) {
  const stored = Array.isArray(row.editorial_modules)
    ? row.editorial_modules.filter((m) => m?.body?.trim())
    : [];
  if (stored.length >= 4) return stored;

  const built = [];
  if (row.history_summary?.trim()) {
    built.push({ id: "history", label: "History", body: row.history_summary.trim() });
  }
  if (row.why_it_matters?.trim()) {
    built.push({
      id: "why_it_matters",
      label: "Why it matters",
      body: row.why_it_matters.trim(),
    });
  }
  if (row.interesting_facts?.length) {
    built.push({
      id: "interesting_facts",
      label: "Interesting facts",
      body: row.interesting_facts.map((f) => f.trim()).filter(Boolean).join(" "),
    });
  }
  if (row.architecture_note?.trim()) {
    built.push({
      id: "architecture",
      label: "Architecture",
      body: row.architecture_note.trim(),
    });
  }
  if (row.best_time_to_visit?.trim()) {
    built.push({
      id: "best_time",
      label: "Best time to visit",
      body: row.best_time_to_visit.trim(),
    });
  }
  if (row.hours_text?.trim()) {
    built.push({ id: "hours", label: "Hours", body: row.hours_text.trim() });
  }
  if (row.admission_text?.trim()) {
    built.push({
      id: "admission",
      label: "Admission",
      body: row.admission_text.trim(),
    });
  }
  if (row.parking_text?.trim()) {
    built.push({ id: "parking", label: "Parking", body: row.parking_text.trim() });
  }
  if (row.accessibility_text?.trim()) {
    built.push({
      id: "accessibility",
      label: "Accessibility",
      body: row.accessibility_text.trim(),
    });
  }
  if (row.nearby_places?.length) {
    built.push({
      id: "nearby",
      label: "Nearby places",
      body: row.nearby_places.join(" · "),
    });
  }
  return built.length ? built : stored;
}

export function rowToSnapshot(row) {
  if (!isApprovedHistoryPlace(row)) return null;

  const body = splitBody(row.story_body);
  if (body.length < 2) return null;

  return {
    id: row.id,
    slug: row.slug,
    placeName: row.place_name.trim(),
    category: row.category,
    categoryLabel: row.category_label?.trim() || CATEGORY_LABELS[row.category],
    teaser: row.editorial_teaser.trim(),
    body,
    modules: modulesFromRow(row),
    closingNote: row.closing_note?.trim() ?? null,
    heroImageUrl: row.hosted_url?.trim() || row.image_url?.trim() || null,
    imageCredit: row.image_credit?.trim() ?? null,
    lat: row.lat,
    lon: row.lon,
    address: row.address?.trim() ?? null,
    city: row.city?.trim() ?? null,
    state: row.state?.trim() ?? null,
    officialWebsite: row.official_website?.trim() ?? null,
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

  const carouselRows = diversifyCarousel(rows);
  const places = rows
    .map((row) => rowToSnapshot(row))
    .filter((p) => p != null);
  const carousel = carouselRows
    .map((row) => rowToSnapshot(row))
    .filter((p) => p != null);

  if (!carousel.length || !places.length) return null;

  return {
    metroKey,
    subtitle: HISTORY_AROUND_TOWN_SUBTITLE,
    carousel,
    places,
  };
}
