/**
 * Local discovery scope — section-specific radii from discoveryGeography.
 */

import type { DiscoveryCategory, RankedDiscoveryItem } from "./discovery.ts";
import { distanceKm } from "../location/locationKey.ts";
import {
  DISCOVERY_ACTIVITY_RADIUS_KM,
  DISCOVERY_FOOD_RADIUS_KM,
} from "./discoveryGeography.ts";
import {
  DESTINATION_ACTIVITY_CATEGORIES,
  FOOD_DRINK_CATEGORIES,
  RECOMMENDATION_CATEGORIES,
} from "./foodDrinkDesk.ts";

export {
  DESTINATION_ACTIVITY_CATEGORIES,
  FOOD_DRINK_CATEGORIES,
  RECOMMENDATION_CATEGORIES,
};

/** @deprecated Use DISCOVERY_FOOD_RADIUS_KM / DISCOVERY_ACTIVITY_RADIUS_KM */
export const RECOMMENDATIONS_RADIUS_MILES = 25;
/** @deprecated Use DISCOVERY_FOOD_RADIUS_KM */
export const RECOMMENDATIONS_RADIUS_KM = DISCOVERY_FOOD_RADIUS_KM;

export const ACTIVITY_CATEGORIES: ReadonlySet<DiscoveryCategory> = new Set([
  "activities",
  "hiking",
  ...DESTINATION_ACTIVITY_CATEGORIES,
]);

export const LOCAL_DISCOVERY_CATEGORIES: ReadonlySet<DiscoveryCategory> =
  new Set([...FOOD_DRINK_CATEGORIES, ...ACTIVITY_CATEGORIES]);

function normalizeCoord(
  value: number | string | null | undefined
): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > 180) {
    return null;
  }
  return n;
}

export function isValidCoord(
  value: number | string | null | undefined
): value is number {
  return normalizeCoord(value) != null;
}

export type ReaderLocation = {
  lat: number;
  lon: number;
};

export function distanceKmFromReader(
  item: Pick<RankedDiscoveryItem["item"], "lat" | "lon">,
  reader: ReaderLocation
): number | null {
  const itemLat = normalizeCoord(item.lat);
  const itemLon = normalizeCoord(item.lon);
  const readerLat = normalizeCoord(reader.lat);
  const readerLon = normalizeCoord(reader.lon);
  if (
    itemLat == null ||
    itemLon == null ||
    readerLat == null ||
    readerLon == null
  ) {
    return null;
  }
  return distanceKm(
    { lat: readerLat, lon: readerLon },
    { lat: itemLat, lon: itemLon }
  );
}

export function isStatewideAttraction(item: RankedDiscoveryItem["item"]): boolean {
  return Boolean(
    item.tags?.includes("nps_park") || item.tags?.includes("national_park")
  );
}

export function discoveryRadiusKmForCategory(
  category: DiscoveryCategory | string
): number {
  if (FOOD_DRINK_CATEGORIES.has(category as DiscoveryCategory)) {
    return DISCOVERY_FOOD_RADIUS_KM;
  }
  return DISCOVERY_ACTIVITY_RADIUS_KM;
}

export function isWithinFoodDiscoveryRadius(
  item: RankedDiscoveryItem,
  reader: ReaderLocation | null | undefined
): boolean {
  if (!FOOD_DRINK_CATEGORIES.has(item.item.category)) return false;
  if (isStatewideAttraction(item.item)) return false;
  if (!reader) return true;
  const km = distanceKmFromReader(item.item, reader);
  if (km == null) return true;
  return km <= DISCOVERY_FOOD_RADIUS_KM;
}

export function isWithinLocalDiscoveryRadius(
  item: RankedDiscoveryItem,
  reader: ReaderLocation | null | undefined
): boolean {
  if (!LOCAL_DISCOVERY_CATEGORIES.has(item.item.category)) return false;
  if (isStatewideAttraction(item.item)) return false;
  if (!reader) return true;
  const km = distanceKmFromReader(item.item, reader);
  // No verified coordinates — keep edition-curated items; enforce radius when present.
  if (km == null) return true;
  return km <= discoveryRadiusKmForCategory(item.item.category);
}

/** @deprecated Use isWithinLocalDiscoveryRadius */
export const isWithinRecommendationRadius = (
  item: RankedDiscoveryItem,
  reader: ReaderLocation | null | undefined
): boolean => isWithinLocalDiscoveryRadius(item, reader);

export function readerLocationFromDiscovery(
  discovery: { location?: { lat?: number | null; lon?: number | null } } | null | undefined
): ReaderLocation | null {
  const lat = normalizeCoord(discovery?.location?.lat);
  const lon = normalizeCoord(discovery?.location?.lon);
  if (lat == null || lon == null) return null;
  return { lat, lon };
}

export function resolveReaderLocation(input: {
  readerLocation?: ReaderLocation | null;
  discovery?: { location?: { lat?: number | null; lon?: number | null } } | null;
}): ReaderLocation | null {
  const direct = input.readerLocation;
  if (
    direct &&
    isValidCoord(direct.lat) &&
    isValidCoord(direct.lon)
  ) {
    return {
      lat: normalizeCoord(direct.lat)!,
      lon: normalizeCoord(direct.lon)!,
    };
  }
  return readerLocationFromDiscovery(input.discovery);
}

export function compareByLocalProximity(
  a: RankedDiscoveryItem,
  b: RankedDiscoveryItem,
  reader: ReaderLocation | null | undefined
): number {
  if (!reader) return (b.score ?? 0) - (a.score ?? 0);
  const kmA = distanceKmFromReader(a.item, reader) ?? 9999;
  const kmB = distanceKmFromReader(b.item, reader) ?? 9999;
  if (Math.abs(kmA - kmB) > 0.5) return kmA - kmB;
  return (b.score ?? 0) - (a.score ?? 0);
}

/** Every item in the Activities section stays within the local newspaper radius. */
export function isWithinActivitiesSectionRadius(
  item: RankedDiscoveryItem,
  reader: ReaderLocation | null | undefined
): boolean {
  if (isStatewideAttraction(item.item)) return false;
  if (!reader) return true;
  const km = distanceKmFromReader(item.item, reader);
  if (km == null) return true;
  return km <= DISCOVERY_ACTIVITY_RADIUS_KM;
}

/** @deprecated Use compareByLocalProximity */
export const compareRecommendationsByProximity = compareByLocalProximity;
