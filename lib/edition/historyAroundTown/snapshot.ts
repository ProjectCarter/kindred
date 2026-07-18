/**
 * History Around Town — snapshot builder (client).
 * Keep field mapping in sync with supabase/functions/_shared/historyAroundTown/snapshot.ts
 */

import { normalizeHistoryPlaceSnapshot } from "./normalize";
import type {
  HistoryNearbyLink,
  HistoryPlaceRow,
  HistoryPlaceSnapshot,
  HistoryTimelineEntry,
} from "./types";

export function splitStoryBody(body: string): string[] {
  return body
    .trim()
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 20);
}

export function resolveHistoricalMetadataLine(row: {
  historical_metadata_line?: string | null;
  year_established?: string | null;
  historical_era?: string | null;
}): string | null {
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

export function parseTimelineEntries(raw: unknown): HistoryTimelineEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const item = entry as { year?: unknown; event?: unknown };
      const year = typeof item.year === "string" ? item.year.trim() : "";
      const event = typeof item.event === "string" ? item.event.trim() : "";
      if (!year || !event) return null;
      return { year, event };
    })
    .filter((entry): entry is HistoryTimelineEntry => entry != null);
}

export function resolveNearbyLinks(
  slugs: string[] | null | undefined,
  slugIndex: Map<string, HistoryPlaceRow>
): HistoryNearbyLink[] {
  const out: HistoryNearbyLink[] = [];
  const seen = new Set<string>();
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

export function buildHistoryPlaceSnapshot(
  row: HistoryPlaceRow,
  slugIndex?: Map<string, HistoryPlaceRow>
): HistoryPlaceSnapshot | null {
  const paragraphs = splitStoryBody(row.story_body);
  if (paragraphs.length < 2) return null;

  const intro =
    row.editorial_introduction?.trim() ||
    paragraphs[0] ||
    null;
  const storyParagraphs = row.editorial_introduction?.trim()
    ? paragraphs
    : paragraphs.slice(1);
  if (!storyParagraphs.length) return null;

  const designations = [
    ...(row.historic_designations ?? []),
    ...(row.historic_designation?.trim()
      ? [row.historic_designation.trim()]
      : []),
  ]
    .map((d) => d.trim())
    .filter(Boolean)
    .filter((d, i, arr) => arr.indexOf(d) === i);

  const timeline = parseTimelineEntries(row.timeline_entries);
  const lookingCloser = (row.looking_closer ?? [])
    .map((item) => item.trim())
    .filter(Boolean);
  const architectureNote = row.architecture_note?.trim() ?? null;
  if (architectureNote && !lookingCloser.length) {
    lookingCloser.push(architectureNote);
  } else if (architectureNote && lookingCloser.length) {
    const hay = lookingCloser.join(" ").toLowerCase();
    if (!hay.includes(architectureNote.slice(0, 24).toLowerCase())) {
      lookingCloser.unshift(architectureNote);
    }
  }

  const facts = (row.interesting_facts ?? [])
    .map((f) => f.trim())
    .filter(Boolean);

  const nearbyLinks = slugIndex
    ? resolveNearbyLinks(row.nearby_place_slugs, slugIndex)
    : (row.nearby_places ?? []).map((name) => ({
        id: name,
        slug: name.toLowerCase().replace(/\s+/g, "-"),
        placeName: name.trim(),
        teaser: null,
        historicalMetadataLine: null,
      }));

  return normalizeHistoryPlaceSnapshot({
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
    timeline,
    didYouKnow: facts,
    visitingToday: row.visiting_today_text?.trim() ?? null,
    beforeYouGo: row.before_you_go_text?.trim() ?? null,
    nearbyLinks,
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
  });
}
