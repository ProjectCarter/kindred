/** History Around Town — client types (keep in sync with server historyAroundTown/types.ts). */

import {
  filterUniqueFacts,
  normalizeHistoryPlaceSnapshot,
} from "./normalize";

export type HistoryPlaceCategory =
  | "historic_district"
  | "historic_home"
  | "museum"
  | "monument"
  | "memorial"
  | "courthouse"
  | "church"
  | "school"
  | "train_depot"
  | "bridge"
  | "military_site"
  | "archaeological_site"
  | "historic_cemetery"
  | "neighborhood"
  | "observatory"
  | "lighthouse"
  | "public_art"
  | "landmark";

export type HistoryTimelineEntry = {
  year: string;
  event: string;
};

export type HistoryNearbyLink = {
  id: string;
  slug: string;
  placeName: string;
  teaser: string | null;
  historicalMetadataLine: string | null;
};

export type HistoryPlaceEditorialModule = {
  id: string;
  label: string;
  body: string;
};

/** Full library row — mirrors kindred_history_places. */
export type HistoryPlaceRow = {
  id: string;
  internal_id: string;
  metro_key: string;
  place_name: string;
  slug: string;
  category: HistoryPlaceCategory;
  category_label: string;
  editorial_teaser: string;
  story_body: string;
  editorial_modules: HistoryPlaceEditorialModule[] | null;
  closing_note: string | null;
  history_summary: string | null;
  why_it_matters: string | null;
  interesting_facts: string[] | null;
  architecture_note: string | null;
  best_time_to_visit: string | null;
  hours_text: string | null;
  admission_text: string | null;
  parking_text: string | null;
  accessibility_text: string | null;
  nearby_places: string[] | null;
  lat: number | null;
  lon: number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  image_url: string | null;
  hosted_url: string | null;
  storage_path: string | null;
  image_credit: string | null;
  image_source_url: string | null;
  image_license: string | null;
  image_photographer: string | null;
  image_era: string | null;
  image_date: string | null;
  image_verification_status: string | null;
  official_website: string | null;
  phone: string | null;
  year_established: string | null;
  historical_era: string | null;
  historical_metadata_line: string | null;
  historic_designation: string | null;
  historic_designations: string[] | null;
  historical_significance: string | null;
  editorial_introduction: string | null;
  looking_closer: string[] | null;
  timeline_entries: HistoryTimelineEntry[] | unknown;
  visiting_today_text: string | null;
  before_you_go_text: string | null;
  visit_duration_text: string | null;
  dog_policy_text: string | null;
  google_maps_url: string | null;
  admission_url: string | null;
  nearby_place_slugs: string[] | null;
  source_urls: string[] | null;
  source_provider: string;
  source_provider_place_id: string | null;
  validation_status: string;
  approval_status: string;
  editorial_priority: number;
  featured: boolean;
  last_reviewed_at: string | null;
  last_shown_date: string | null;
  use_count: number;
};

/** Frozen place — copied into editions.history_around_town at build time. */
export type HistoryPlaceSnapshot = {
  id: string;
  slug: string;
  placeName: string;
  category: HistoryPlaceCategory;
  categoryLabel: string;
  teaser: string;
  historicalMetadataLine: string | null;
  yearEstablished: string | null;
  historicalEra: string | null;
  designations: string[];
  editorialIntroduction: string | null;
  theStory: string[];
  whyItMatters: string | null;
  lookingCloser: string[];
  timeline: HistoryTimelineEntry[];
  didYouKnow: string[];
  visitingToday: string | null;
  beforeYouGo: string | null;
  nearbyLinks: HistoryNearbyLink[];
  closingNote: string | null;
  heroImageUrl: string | null;
  imageCredit: string | null;
  imageSourceUrl: string | null;
  imageLicense: string | null;
  imagePhotographer: string | null;
  imageEra: string | null;
  imageDate: string | null;
  lat: number | null;
  lon: number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  officialWebsite: string | null;
  googleMapsUrl: string | null;
  admissionUrl: string | null;
  hoursText: string | null;
  admissionText: string | null;
  parkingText: string | null;
  accessibilityText: string | null;
  bestTimeToVisit: string | null;
  visitDuration: string | null;
  dogPolicy: string | null;
  /** @deprecated v1.0 — use theStory + editorialIntroduction */
  body: string[];
  /** @deprecated v1.0 flat modules */
  modules: HistoryPlaceEditorialModule[];
  /** @deprecated v1.0 name-only nearby list */
  nearbyPlaces: string[];
};

export type HistoryAroundTownEditionPayload = {
  metroKey: string;
  subtitle: string;
  carousel: HistoryPlaceSnapshot[];
  places: HistoryPlaceSnapshot[];
};

export const HISTORY_AROUND_TOWN_SUBTITLE =
  "Every town has a story waiting to be explored.";

export const HISTORY_AROUND_TOWN_CAROUSEL_LIMIT = 20;

export type HistoryAroundTownCard = {
  id: string;
  categoryLabel: string;
  placeName: string;
  teaser: string;
  historicalMetadataLine: string | null;
  imageUrl: string | null;
  city: string | null;
  place: HistoryPlaceSnapshot;
};

export function parseHistoryAroundTownPayload(
  raw: unknown
): HistoryAroundTownEditionPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as HistoryAroundTownEditionPayload;
  if (!payload.metroKey?.trim()) return null;
  if (!Array.isArray(payload.places) || !payload.places.length) return null;
  if (!Array.isArray(payload.carousel) || !payload.carousel.length) return null;
  return {
    metroKey: payload.metroKey,
    subtitle: payload.subtitle?.trim() || HISTORY_AROUND_TOWN_SUBTITLE,
    carousel: payload.carousel.map(normalizeHistoryPlaceSnapshot),
    places: payload.places.map(normalizeHistoryPlaceSnapshot),
  };
}

export { filterUniqueFacts, normalizeHistoryPlaceSnapshot };

export function historyPlaceToCard(place: HistoryPlaceSnapshot): HistoryAroundTownCard {
  const normalized = normalizeHistoryPlaceSnapshot(place);
  return {
    id: normalized.id,
    categoryLabel: normalized.categoryLabel,
    placeName: normalized.placeName,
    teaser: normalized.teaser,
    historicalMetadataLine: normalized.historicalMetadataLine,
    imageUrl: normalized.heroImageUrl,
    city: normalized.city,
    place: normalized,
  };
}

export function selectHistoryAroundTownCarousel(
  payload: HistoryAroundTownEditionPayload | null | undefined
): HistoryAroundTownCard[] {
  if (!payload?.carousel?.length) return [];
  return payload.carousel.map(historyPlaceToCard);
}

export function cityRegionLine(place: HistoryPlaceSnapshot): string | null {
  const parts = [place.city, place.state].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

export function visitorInfoRows(
  place: HistoryPlaceSnapshot
): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  if (place.address?.trim()) rows.push({ label: "Address", value: place.address.trim() });
  if (place.hoursText?.trim()) rows.push({ label: "Hours", value: place.hoursText.trim() });
  if (place.admissionText?.trim()) {
    rows.push({ label: "Admission", value: place.admissionText.trim() });
  }
  if (place.parkingText?.trim()) rows.push({ label: "Parking", value: place.parkingText.trim() });
  if (place.accessibilityText?.trim()) {
    rows.push({ label: "Accessibility", value: place.accessibilityText.trim() });
  }
  if (place.bestTimeToVisit?.trim()) {
    rows.push({ label: "Best time to visit", value: place.bestTimeToVisit.trim() });
  }
  if (place.visitDuration?.trim()) {
    rows.push({ label: "Estimated visit", value: place.visitDuration.trim() });
  }
  if (place.dogPolicy?.trim()) rows.push({ label: "Dogs", value: place.dogPolicy.trim() });
  return rows;
}
