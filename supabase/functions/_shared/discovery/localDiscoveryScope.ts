/**
 * Local discovery scope — section-specific radii from discoveryGeography.
 */

import {
  DISCOVERY_ACTIVITY_RADIUS_KM,
  DISCOVERY_FOOD_RADIUS_KM,
} from "../editorial/discoveryGeography.ts";
import { haversineKm } from "./geo.ts";
import type { DiscoveryCategory, DiscoveryItem, RankedDiscoveryItem } from "./types.ts";
import type { DiscoveryRankingContext } from "./types.ts";
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

/** Desks that share the 25-mile local newspaper radius. */
export const LOCAL_DISCOVERY_CATEGORIES: ReadonlySet<DiscoveryCategory> =
  new Set([...FOOD_DRINK_CATEGORIES, ...ACTIVITY_CATEGORIES]);

export const RECOMMENDATION_SURFACES = new Set([
  "coffee",
  "restaurants",
  "bakeries",
]);

export const LOCAL_DISCOVERY_SURFACES = new Set([
  ...RECOMMENDATION_SURFACES,
  "activities",
  "hiking",
  "museums",
  "parks",
  "beaches",
  "gardens",
  "scenic_drives",
]);

function normalizeCoord(
  value: number | string | null | undefined
): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > 180) {
    return null;
  }
  return n;
}

function isValidCoord(
  value: number | string | null | undefined
): value is number {
  return normalizeCoord(value) != null;
}

export function isStatewideAttraction(item: DiscoveryItem): boolean {
  return item.tags.includes("nps_park") || item.tags.includes("national_park");
}

export function discoveryRadiusKmForCategory(
  category: DiscoveryCategory | string
): number {
  if (FOOD_DRINK_CATEGORIES.has(category as DiscoveryCategory)) {
    return DISCOVERY_FOOD_RADIUS_KM;
  }
  return DISCOVERY_ACTIVITY_RADIUS_KM;
}

export function distanceKmFromReader(
  item: Pick<DiscoveryItem, "lat" | "lon">,
  ctx: Pick<DiscoveryRankingContext, "readerLat" | "readerLon">
): number | null {
  const itemLat = normalizeCoord(item.lat);
  const itemLon = normalizeCoord(item.lon);
  const readerLat = normalizeCoord(ctx.readerLat);
  const readerLon = normalizeCoord(ctx.readerLon);
  if (
    itemLat == null ||
    itemLon == null ||
    readerLat == null ||
    readerLon == null
  ) {
    return null;
  }
  return haversineKm(readerLat, readerLon, itemLat, itemLon);
}

export function passesLocalDiscoveryRadius(
  ranked: RankedDiscoveryItem,
  ctx: Pick<DiscoveryRankingContext, "readerLat" | "readerLon">
): boolean {
  const item = ranked.item;
  if (!LOCAL_DISCOVERY_CATEGORIES.has(item.category)) return true;
  if (isStatewideAttraction(item)) return false;
  const km = distanceKmFromReader(item, ctx);
  if (km == null) return true;
  return km <= discoveryRadiusKmForCategory(item.category);
}

/** @deprecated Use passesLocalDiscoveryRadius */
export const passesRecommendationRadius = passesLocalDiscoveryRadius;

export function surfaceUsesLocalDiscoveryRadius(surface: string): boolean {
  return LOCAL_DISCOVERY_SURFACES.has(surface);
}

/** @deprecated Use surfaceUsesLocalDiscoveryRadius */
export const surfaceUsesRecommendationRadius = surfaceUsesLocalDiscoveryRadius;

/** Every item in the Activities section stays within the activity discovery radius. */
export function passesActivitiesSectionRadius(
  ranked: RankedDiscoveryItem,
  ctx: Pick<DiscoveryRankingContext, "readerLat" | "readerLon">
): boolean {
  const item = ranked.item;
  if (isStatewideAttraction(item)) return false;
  const km = distanceKmFromReader(item, ctx);
  if (km == null) return true;
  return km <= DISCOVERY_ACTIVITY_RADIUS_KM;
}
