/**
 * Discovery geography — Gilbert identity + Phoenix Metro hybrid model.
 *
 * Central rules for which homepage desks are city-specific, metro-wide, or
 * radius-scoped from the reader. Server edition build imports this module
 * directly; keep server mirrors thin.
 */

import {
  catalogMetroKeyForMarket,
  resolveEditionMarket,
  type EditionLocationInput,
  type ResolvedEditionMarket,
} from "../markets/resolveEditionMarket.ts";

/** Local Events — full Phoenix Metro catalog (market isolation gate). */
export const DISCOVERY_EVENTS_SCOPE = "phoenix_metro" as const;
export const DISCOVERY_EVENTS_METRO_ISOLATION_MILES = 50;

/** Activities + Historical Places — reader-centered nearby discovery. */
export const DISCOVERY_ACTIVITY_RADIUS_MILES = 25;
export const DISCOVERY_HISTORICAL_PLACES_RADIUS_MILES = 25;

/** Food & Drinks — tighter local dining radius from the reader. */
export const DISCOVERY_FOOD_RADIUS_MILES = 15;

const MILES_TO_KM = 1.609344;

export const DISCOVERY_EVENTS_METRO_ISOLATION_KM =
  DISCOVERY_EVENTS_METRO_ISOLATION_MILES * MILES_TO_KM;
export const DISCOVERY_ACTIVITY_RADIUS_KM =
  DISCOVERY_ACTIVITY_RADIUS_MILES * MILES_TO_KM;
export const DISCOVERY_FOOD_RADIUS_KM = DISCOVERY_FOOD_RADIUS_MILES * MILES_TO_KM;
export const DISCOVERY_HISTORICAL_PLACES_RADIUS_KM =
  DISCOVERY_HISTORICAL_PLACES_RADIUS_MILES * MILES_TO_KM;

export type DiscoveryGeographySnapshot = {
  userCity: string | null;
  resolvedMetro: string | null;
  eventsScope: string;
  activitiesRadiusMiles: number;
  foodRadiusMiles: number;
  localNewsScope: string;
  historicalPlacesRadiusMiles: number;
  weatherScope: string;
};

export function resolveEditionMarketForReader(
  input: EditionLocationInput
): ResolvedEditionMarket {
  return resolveEditionMarket(input);
}

export function catalogMetroKeyForReaderLocation(
  input: EditionLocationInput
): string {
  return catalogMetroKeyForMarket(resolveEditionMarket(input));
}

export function resolveDiscoveryGeographySnapshot(input: {
  city?: string | null;
  market?: ResolvedEditionMarket | null;
}): DiscoveryGeographySnapshot {
  const userCity = input.city?.trim() || null;
  const resolvedMetro = input.market
    ? catalogMetroKeyForMarket(input.market)
    : null;
  const weatherScope = userCity ?? "reader city";

  return {
    userCity,
    resolvedMetro,
    eventsScope: "Phoenix Metro",
    activitiesRadiusMiles: DISCOVERY_ACTIVITY_RADIUS_MILES,
    foodRadiusMiles: DISCOVERY_FOOD_RADIUS_MILES,
    localNewsScope: "Gilbert with Phoenix Metro fallback",
    historicalPlacesRadiusMiles: DISCOVERY_HISTORICAL_PLACES_RADIUS_MILES,
    weatherScope,
  };
}

/** Structured log for edition build + diagnostics scripts. */
export function logDiscoveryGeography(
  scope: string,
  snapshot: DiscoveryGeographySnapshot,
  extra?: Record<string, unknown>
): void {
  console.log("[kindred:discovery-geography]", {
    scope,
    userCity: snapshot.userCity,
    resolvedMetro: snapshot.resolvedMetro,
    eventsScope: snapshot.eventsScope,
    activitiesRadiusMiles: snapshot.activitiesRadiusMiles,
    foodRadiusMiles: snapshot.foodRadiusMiles,
    localNewsScope: snapshot.localNewsScope,
    historicalPlacesRadiusMiles: snapshot.historicalPlacesRadiusMiles,
    weatherScope: snapshot.weatherScope,
    ...extra,
  });
}
