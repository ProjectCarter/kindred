/**
 * Local discovery scope — 25-mile radius for Recommendations and Activities.
 */

import { KINDRED_LOCAL_RADIUS_KM } from "../editorial/editorialStandard.ts";
import { haversineKm } from "./geo.ts";
import type { DiscoveryCategory, DiscoveryItem, RankedDiscoveryItem } from "./types.ts";
import type { DiscoveryRankingContext } from "./types.ts";

/** @deprecated Use KINDRED_LOCAL_RADIUS_KM from editorialStandard.ts */
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

/** Desks that share the 25-mile local newspaper radius. */
export const LOCAL_DISCOVERY_CATEGORIES: ReadonlySet<DiscoveryCategory> =
  new Set([...RECOMMENDATION_CATEGORIES, ...ACTIVITY_CATEGORIES]);

export const RECOMMENDATION_SURFACES = new Set([
  "coffee",
  "restaurants",
  "bakeries",
  "beaches",
  "parks",
  "museums",
  "scenic_drives",
  "gardens",
]);

export const LOCAL_DISCOVERY_SURFACES = new Set([
  ...RECOMMENDATION_SURFACES,
  "activities",
  "hiking",
]);

function isValidCoord(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 180;
}

export function isStatewideAttraction(item: DiscoveryItem): boolean {
  return item.tags.includes("nps_park") || item.tags.includes("national_park");
}

export function distanceKmFromReader(
  item: Pick<DiscoveryItem, "lat" | "lon">,
  ctx: Pick<DiscoveryRankingContext, "readerLat" | "readerLon">
): number | null {
  if (
    !isValidCoord(ctx.readerLat) ||
    !isValidCoord(ctx.readerLon) ||
    !isValidCoord(item.lat) ||
    !isValidCoord(item.lon)
  ) {
    return null;
  }
  return haversineKm(ctx.readerLat, ctx.readerLon, item.lat, item.lon);
}

export function passesLocalDiscoveryRadius(
  ranked: RankedDiscoveryItem,
  ctx: DiscoveryRankingContext
): boolean {
  const item = ranked.item;
  if (!LOCAL_DISCOVERY_CATEGORIES.has(item.category)) return true;
  if (isStatewideAttraction(item)) return false;
  const km = distanceKmFromReader(item, ctx);
  if (km == null) return false;
  return km <= KINDRED_LOCAL_RADIUS_KM;
}

/** @deprecated Use passesLocalDiscoveryRadius */
export const passesRecommendationRadius = passesLocalDiscoveryRadius;

export function surfaceUsesLocalDiscoveryRadius(surface: string): boolean {
  return LOCAL_DISCOVERY_SURFACES.has(surface);
}

/** @deprecated Use surfaceUsesLocalDiscoveryRadius */
export const surfaceUsesRecommendationRadius = surfaceUsesLocalDiscoveryRadius;

/** Every item in the Activities section stays within the local newspaper radius. */
export function passesActivitiesSectionRadius(
  ranked: RankedDiscoveryItem,
  ctx: DiscoveryRankingContext
): boolean {
  const item = ranked.item;
  if (isStatewideAttraction(item)) return false;
  const km = distanceKmFromReader(item, ctx);
  if (km == null) return false;
  return km <= KINDRED_LOCAL_RADIUS_KM;
}
