/**
 * Food & Drink catalog — normalization, fingerprinting, verification.
 */

import type { SourceHistoryEntry, VenueFieldSources } from "../editorial/sourceManager.ts";
import type { VenueLifecycle } from "../editorial/venueLifecycle.ts";
import { KINDRED_LOCAL_RADIUS_KM } from "../editorial/editorialStandard.ts";
import { isLowValueVenue, venueHayFromParts } from "../editorial/venueQuality.ts";
import { haversineKm } from "../discovery/geo.ts";
import type { NormalizedPlace, PlacesCategory } from "./types.ts";

const FOOD_PROVIDER_CATEGORIES: readonly PlacesCategory[] = [
  "coffee",
  "restaurants",
  "bakeries",
];

export type FoodDrinkCatalogStatus = "active" | "rejected" | "duplicate" | "possibly_closed";

export type FoodDrinkCatalogRow = {
  /** Permanent Kindred venue ID. */
  id: string;
  metro_key: string;
  provider: string;
  provider_id: string;
  provider_category: string;
  name: string;
  normalized_name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  lat: number | null;
  lon: number | null;
  url: string | null;
  phone: string | null;
  cuisine: string | null;
  provider_categories: string[];
  editorial_categories: string[];
  editorial_tags: string[];
  note: string | null;
  editorial_teaser: string | null;
  editorial_article: string | null;
  opening_hours: Record<string, unknown> | null;
  price_level: number | null;
  photos: unknown[];
  content_fingerprint: string;
  status: FoodDrinkCatalogStatus;
  lifecycle: VenueLifecycle;
  confidence_score: number;
  verification_status: string;
  field_sources: VenueFieldSources;
  source_history: SourceHistoryEntry[];
  rejection_reason: string | null;
  duplicate_of: string | null;
  first_seen_at: string;
  last_verified_at: string;
  discovered_at: string | null;
  editorial_note_at: string | null;
  editorial_score: number;
  editorial_labels: string[];
  editorial_reason: string | null;
  editorial_score_version: number;
  editorial_scored_at: string | null;
  editorial_score_evidence: Record<string, unknown>;
  editorial_score_previous: number | null;
  editorial_score_change_reason: string | null;
  editorial_score_material_fingerprint: string | null;
  editorial_lock: boolean;
  editorial_score_override: number | null;
  editorial_labels_override: string[] | null;
  editorial_reason_override: string | null;
  override_author: string | null;
  override_timestamp: string | null;
  editorial_override_history: unknown[];
};

export function normalizeCatalogName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCatalogUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, "");
    return `${host}${path}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, "");
  }
}

export function catalogContentFingerprint(place: NormalizedPlace): string {
  const parts = [
    place.name.trim(),
    place.address?.trim() ?? "",
    place.city?.trim() ?? "",
    place.state?.trim() ?? "",
    place.lat != null ? String(place.lat) : "",
    place.lon != null ? String(place.lon) : "",
    place.url?.trim() ?? "",
    place.category,
    place.providerCategories.join("|"),
  ];
  return parts.join("::").toLowerCase();
}

export function placeWithinMetroRadius(
  place: NormalizedPlace,
  metro: { lat: number; lon: number }
): boolean {
  if (place.lat == null || place.lon == null) return false;
  return haversineKm(metro.lat, metro.lon, place.lat, place.lon) <= KINDRED_LOCAL_RADIUS_KM;
}

export type FoodDrinkVerificationResult =
  | { ok: true }
  | { ok: false; reason: string };

export function verifyFoodDrinkPlace(
  place: NormalizedPlace,
  metro: { lat: number; lon: number }
): FoodDrinkVerificationResult {
  const name = place.name?.trim();
  if (!name || name.length < 2) {
    return { ok: false, reason: "missing_name" };
  }

  if (!FOOD_PROVIDER_CATEGORIES.includes(place.category as PlacesCategory)) {
    return { ok: false, reason: "invalid_category" };
  }

  if (!placeWithinMetroRadius(place, metro)) {
    return { ok: false, reason: "outside_radius" };
  }

  const hay = venueHayFromParts([
    name,
    place.address,
    ...(place.providerCategories ?? []),
  ]);
  if (isLowValueVenue(hay)) {
    return { ok: false, reason: "low_value_venue" };
  }

  if (place.lat == null || place.lon == null) {
    return { ok: false, reason: "missing_coordinates" };
  }

  if (!place.url?.trim()) {
    return { ok: false, reason: "missing_provider_url" };
  }

  return { ok: true };
}

export function catalogRowToNormalizedPlace(row: FoodDrinkCatalogRow): NormalizedPlace {
  return {
    providerId: row.provider_id,
    name: row.name,
    category: row.provider_category as PlacesCategory,
    address: row.address,
    city: row.city,
    state: row.state,
    lat: row.lat,
    lon: row.lon,
    url: row.url,
    providerCategories: row.provider_categories ?? [],
    rating: null,
    priceTier: null,
    note: row.editorial_teaser ?? row.note,
  };
}

export function normalizedPlaceToCatalogInsert(
  place: NormalizedPlace,
  metroKey: string,
  now: string
): Omit<FoodDrinkCatalogRow, "id" | "duplicate_of"> {
  return {
    metro_key: metroKey,
    provider: "foursquare",
    provider_id: place.providerId,
    provider_category: place.category,
    name: place.name.trim(),
    normalized_name: normalizeCatalogName(place.name),
    address: place.address,
    city: place.city,
    state: place.state,
    lat: place.lat,
    lon: place.lon,
    url: place.url,
    provider_categories: place.providerCategories ?? [],
    editorial_categories: [place.category],
    editorial_tags: [],
    note: place.note ?? null,
    editorial_teaser: place.note ?? null,
    editorial_article: null,
    phone: null,
    cuisine: null,
    opening_hours: null,
    price_level: place.priceTier,
    photos: [],
    content_fingerprint: catalogContentFingerprint(place),
    status: "active",
    lifecycle: "new",
    confidence_score: 0,
    verification_status: "pending",
    field_sources: {},
    source_history: [],
    editorial_score: 0,
    editorial_labels: [],
    editorial_reason: null,
    editorial_score_version: 0,
    editorial_scored_at: null,
    editorial_score_evidence: {},
    editorial_score_previous: null,
    editorial_score_change_reason: null,
    editorial_score_material_fingerprint: null,
    editorial_lock: false,
    editorial_score_override: null,
    editorial_labels_override: null,
    editorial_reason_override: null,
    override_author: null,
    override_timestamp: null,
    editorial_override_history: [],
    rejection_reason: null,
    first_seen_at: now,
    last_verified_at: now,
    discovered_at: now,
    editorial_note_at: place.note ? now : null,
  };
}

/** Find duplicate of an existing active row (normalized name + proximity). */
export function findCatalogDuplicate(
  candidate: NormalizedPlace,
  existing: FoodDrinkCatalogRow[]
): FoodDrinkCatalogRow | null {
  const normalized = normalizeCatalogName(candidate.name);
  for (const row of existing) {
    if (
      row.lifecycle === "rejected" ||
      row.lifecycle === "duplicate" ||
      row.lifecycle === "closed"
    ) {
      continue;
    }
    if (row.provider_id === candidate.providerId) continue;
    if (row.normalized_name !== normalized) continue;
    if (
      candidate.lat != null &&
      candidate.lon != null &&
      row.lat != null &&
      row.lon != null
    ) {
      const km = haversineKm(candidate.lat, candidate.lon, row.lat, row.lon);
      if (km <= 0.15) return row;
    }
    if (
      candidate.address?.trim() &&
      row.address?.trim() &&
      candidate.address.trim().toLowerCase() === row.address.trim().toLowerCase()
    ) {
      return row;
    }
    if (candidate.url?.trim() && row.url?.trim()) {
      if (normalizeCatalogUrl(candidate.url) === normalizeCatalogUrl(row.url)) {
        return row;
      }
    }
  }
  return null;
}

/** Estimated Foursquare Places API cost per search page (USD). Override via env. */
export function estimatedCostPerApiCall(): number {
  const raw = Deno.env.get("FOURSQUARE_ESTIMATED_COST_PER_CALL");
  const parsed = raw ? Number(raw) : 0.001;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0.001;
}
