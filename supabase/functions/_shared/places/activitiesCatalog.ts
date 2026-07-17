/**
 * Activities catalog — normalization, fingerprinting, verification.
 */

import { KINDRED_LOCAL_RADIUS_KM } from "../editorial/editorialStandard.ts";
import { haversineKm } from "../discovery/geo.ts";
import { isLowValueVenue, venueHayFromParts } from "../editorial/venueQuality.ts";
import type { NormalizedPlace, PlacesCategory } from "../places/types.ts";

export type ActivityCatalogLifecycle =
  | "discovered"
  | "verified"
  | "active"
  | "featured"
  | "needs_review"
  | "inactive"
  | "archived"
  | "rejected"
  | "duplicate";

export const ACTIVITY_CATALOG_BROWSE_LIFECYCLES: readonly ActivityCatalogLifecycle[] = [
  "verified",
  "active",
  "featured",
];

export type ActivitiesCatalogRow = {
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
  opening_hours: Record<string, unknown> | null;
  price_level: number | null;
  provider_categories: string[];
  experience_fingerprint: string | null;
  content_fingerprint: string;
  lifecycle: ActivityCatalogLifecycle;
  verification_status: string;
  confidence_score: number;
  field_sources: Record<string, unknown>;
  source_history: unknown[];
  editorial_teaser: string | null;
  editorial_article: string | null;
  note: string | null;
  status: string;
  rejection_reason: string | null;
  duplicate_of: string | null;
  first_seen_at: string;
  last_verified_at: string;
  last_material_change_at: string | null;
};

export function normalizeActivityName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function activityContentFingerprint(place: NormalizedPlace): string {
  return [
    place.name,
    place.address ?? "",
    place.city ?? "",
    place.url ?? "",
    place.category,
    String(place.lat ?? ""),
    String(place.lon ?? ""),
  ]
    .join("|")
    .toLowerCase();
}

export function activityExperienceFingerprint(place: NormalizedPlace): string {
  return `${place.category}|${normalizeActivityName(place.name)}`;
}

export function placeWithinActivityMetroRadius(
  place: NormalizedPlace,
  metro: { lat: number; lon: number }
): boolean {
  if (place.lat == null || place.lon == null) return false;
  return haversineKm(metro.lat, metro.lon, place.lat, place.lon) <= KINDRED_LOCAL_RADIUS_KM;
}

export function verifyActivityPlace(
  place: NormalizedPlace,
  metro: { lat: number; lon: number; city: string }
): { ok: boolean; reason?: string; confidence: number } {
  if (!place.name?.trim()) return { ok: false, reason: "missing_name", confidence: 0 };
  if (!place.providerId?.trim()) return { ok: false, reason: "missing_provider_id", confidence: 0 };
  if (!placeWithinActivityMetroRadius(place, metro)) {
    return { ok: false, reason: "outside_radius", confidence: 0 };
  }

  const hay = venueHayFromParts([
    place.name,
    place.address,
    ...(place.providerCategories ?? []),
  ]);
  if (isLowValueVenue(hay)) {
    return { ok: false, reason: "low_value_venue", confidence: 0 };
  }

  let confidence = 72;
  if (place.url?.trim()) confidence += 8;
  if (place.lat != null && place.lon != null) confidence += 10;
  if (place.address?.trim()) confidence += 5;

  return { ok: true, confidence: Math.min(confidence, 95) };
}

export function findActivityCatalogDuplicate(
  place: NormalizedPlace,
  rows: ActivitiesCatalogRow[]
): ActivitiesCatalogRow | null {
  const byProvider = rows.find((row) => row.provider_id === place.providerId);
  if (byProvider) return byProvider;

  const normalized = normalizeActivityName(place.name);
  const url = place.url?.trim().toLowerCase() ?? "";
  for (const row of rows) {
    if (row.normalized_name === normalized && row.provider_category === place.category) {
      return row;
    }
    if (url && row.url?.trim().toLowerCase() === url) return row;
  }
  return null;
}

export function resolveActivityLifecycleAfterImport(input: {
  current: ActivityCatalogLifecycle;
  confidence: number;
  passesVerification: boolean;
  isNewDiscovery: boolean;
  missingFromFullSync: boolean;
}): ActivityCatalogLifecycle {
  const { current, confidence, passesVerification, isNewDiscovery, missingFromFullSync } =
    input;

  if (current === "rejected" || current === "duplicate") return current;
  if (current === "inactive" || current === "archived") return current;
  if (current === "featured") return "featured";

  if (!passesVerification) {
    return isNewDiscovery ? "rejected" : "needs_review";
  }

  if (missingFromFullSync) return "needs_review";

  if (isNewDiscovery) return "discovered";
  if (confidence >= 80 && (current === "verified" || current === "active")) return "active";
  if (confidence >= 70) return "verified";
  return "needs_review";
}

export function activityLifecycleAfterMissingFromSync(
  current: ActivityCatalogLifecycle
): ActivityCatalogLifecycle {
  if (current === "rejected" || current === "duplicate" || current === "inactive") {
    return current;
  }
  return "needs_review";
}

export function rowToNormalizedPlace(row: ActivitiesCatalogRow): NormalizedPlace {
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
    priceTier: row.price_level,
    kindredVenueId: row.id,
    note: row.editorial_teaser ?? row.note,
  };
}
