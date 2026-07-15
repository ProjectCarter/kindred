/**
 * Local discovery scope — 25-mile radius for Recommendations and Activities.
 */

import type { DiscoveryCategory, RankedDiscoveryItem } from "./discovery";
import { distanceKm } from "../location/locationKey";
import { KINDRED_LOCAL_RADIUS_KM } from "./editorialStandard";

/** @deprecated Use KINDRED_LOCAL_RADIUS_KM */
export const RECOMMENDATIONS_RADIUS_MILES = 25;
/** @deprecated Use KINDRED_LOCAL_RADIUS_KM */
export const RECOMMENDATIONS_RADIUS_KM = KINDRED_LOCAL_RADIUS_KM;

export const RECOMMENDATION_CATEGORIES: ReadonlySet<DiscoveryCategory> =
  new Set([
    "restaurants",
    "coffee",
    "bakeries",
    "beaches",
    "parks",
    "museums",
    "scenic_drives",
    "gardens",
  ]);

export const ACTIVITY_CATEGORIES: ReadonlySet<DiscoveryCategory> = new Set([
  "activities",
  "hiking",
]);

export const LOCAL_DISCOVERY_CATEGORIES: ReadonlySet<DiscoveryCategory> =
  new Set([...RECOMMENDATION_CATEGORIES, ...ACTIVITY_CATEGORIES]);

export function isValidCoord(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 180;
}

export type ReaderLocation = {
  lat: number;
  lon: number;
};

export function distanceKmFromReader(
  item: Pick<RankedDiscoveryItem["item"], "lat" | "lon">,
  reader: ReaderLocation
): number | null {
  if (!isValidCoord(item.lat) || !isValidCoord(item.lon)) return null;
  if (!isValidCoord(reader.lat) || !isValidCoord(reader.lon)) return null;
  return distanceKm(
    { lat: reader.lat, lon: reader.lon },
    { lat: item.lat, lon: item.lon }
  );
}

export function isStatewideAttraction(item: RankedDiscoveryItem["item"]): boolean {
  return Boolean(
    item.tags?.includes("nps_park") || item.tags?.includes("national_park")
  );
}

export function isWithinLocalDiscoveryRadius(
  item: RankedDiscoveryItem,
  reader: ReaderLocation | null | undefined
): boolean {
  if (!LOCAL_DISCOVERY_CATEGORIES.has(item.item.category)) return false;
  if (isStatewideAttraction(item.item)) return false;
  if (!reader) return true;
  const km = distanceKmFromReader(item.item, reader);
  if (km == null) return false;
  return km <= KINDRED_LOCAL_RADIUS_KM;
}

/** @deprecated Use isWithinLocalDiscoveryRadius */
export const isWithinRecommendationRadius = (
  item: RankedDiscoveryItem,
  reader: ReaderLocation | null | undefined
): boolean => isWithinLocalDiscoveryRadius(item, reader);

export function readerLocationFromDiscovery(
  discovery: { location?: { lat?: number | null; lon?: number | null } } | null | undefined
): ReaderLocation | null {
  const lat = discovery?.location?.lat;
  const lon = discovery?.location?.lon;
  if (!isValidCoord(lat) || !isValidCoord(lon)) return null;
  return { lat, lon };
}

export function resolveReaderLocation(input: {
  readerLocation?: ReaderLocation | null;
  discovery?: { location?: { lat?: number | null; lon?: number | null } } | null;
}): ReaderLocation | null {
  if (input.readerLocation) return input.readerLocation;
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
  if (km == null) return false;
  return km <= KINDRED_LOCAL_RADIUS_KM;
}

/** @deprecated Use compareByLocalProximity */
export const compareRecommendationsByProximity = compareByLocalProximity;
