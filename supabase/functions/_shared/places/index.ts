/**
 * Public entry point for the local-places integration.
 * Everything else (Edge Functions, Discovery Engine) should only ever
 * import from here — never reach into cache.ts or foursquareProvider.ts
 * directly. That's what keeps the provider swappable.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getCachedPlaces } from "./cache.ts";
import {
  loadActivitiesCatalogPlaces,
  registerActivitiesMetro,
} from "./activitiesCatalogSync.ts";
import {
  loadFoodDrinkCatalogPlaces,
  metroKeyFromLocation,
  registerFoodDrinkMetro,
} from "./foodDrinkCatalogSync.ts";
import type {
  NormalizedPlace,
  PlacesCategory,
  PlacesLocation,
} from "./types.ts";

export {
  registerActivitiesMetro,
  loadActivitiesCatalogPlaces,
} from "./activitiesCatalogSync.ts";
export {
  registerFoodDrinkMetro,
  loadFoodDrinkCatalogPlaces,
  metroKeyFromLocation,
} from "./foodDrinkCatalogSync.ts";

/** Every desk Food & Drink covers — eat and drink only. */
export const RECOMMENDATION_PLACES_CATEGORIES: PlacesCategory[] = [
  "coffee",
  "restaurants",
  "bakeries",
];

const FOOD_DRINK_CATEGORY_SET = new Set<PlacesCategory>(RECOMMENDATION_PLACES_CATEGORIES);

/** Destination experiences claimed by Activities — museums, parks, beaches, etc. */
export const DESTINATION_PLACES_CATEGORIES: PlacesCategory[] = [
  "parks",
  "museums",
  "scenic_drives",
  "gardens",
  "beaches",
  "attractions",
];

/** Every desk Activities covers with verified place data ("what should I go do?"). */
export const ACTIVITY_PLACES_CATEGORIES: PlacesCategory[] = [
  "water_recreation",
  "escape_rooms",
  "bowling",
  "mini_golf",
  "rock_climbing",
  "axe_throwing",
  "go_karts",
  "pickleball",
  "arcades",
  "laser_tag",
  "paintball",
  "billiards",
  "roller_skating",
  "ice_skating",
  "karaoke",
  "batting_cages",
  ...DESTINATION_PLACES_CATEGORIES,
];

/** Full roster fetched per metro — Food & Drink + Activities combined. */
export const ALL_PLACES_CATEGORIES: PlacesCategory[] = [
  ...RECOMMENDATION_PLACES_CATEGORIES,
  ...ACTIVITY_PLACES_CATEGORIES,
];

const ACTIVITY_CATEGORY_SET = new Set<PlacesCategory>(ACTIVITY_PLACES_CATEGORIES);

/** Dedupe provider rows when the same venue appears in multiple category searches. */
export function dedupePlacesByProviderId(
  places: NormalizedPlace[]
): NormalizedPlace[] {
  const byId = new Map<string, NormalizedPlace>();
  for (const place of places) {
    if (!byId.has(place.providerId)) byId.set(place.providerId, place);
  }
  return Array.from(byId.values());
}

/**
 * Fetch verified local places for a metro across every category.
 *
 * Food & Drink reads `food_drink_catalog`; Activities reads
 * `activities_catalog` — zero Foursquare calls at edition time.
 */
export async function getLocalPlaces(
  admin: SupabaseClient,
  location: PlacesLocation,
  categories: PlacesCategory[] = ALL_PLACES_CATEGORIES
): Promise<NormalizedPlace[]> {
  if (!location.city || location.city === "your area") return [];

  try {
    await registerFoodDrinkMetro(admin, location);
    await registerActivitiesMetro(admin, location);
    const metroKey = metroKeyFromLocation(location);

    const results = await Promise.all(
      categories.map(async (category) => {
        if (FOOD_DRINK_CATEGORY_SET.has(category)) {
          return loadFoodDrinkCatalogPlaces(admin, metroKey, category);
        }
        if (ACTIVITY_CATEGORY_SET.has(category)) {
          return loadActivitiesCatalogPlaces(admin, metroKey, category);
        }
        return getCachedPlaces(admin, location, category);
      })
    );
    const merged = dedupePlacesByProviderId(results.flat());
    const foodDiscovered = merged.filter((p) =>
      RECOMMENDATION_PLACES_CATEGORIES.includes(p.category)
    ).length;
    if (foodDiscovered > 0) {
      console.log("[places] metro catalog merged", {
        city: location.city,
        categories: categories.length,
        uniquePlaces: merged.length,
        foodDrinkDiscovered: foodDiscovered,
      });
    }
    return merged;
  } catch (err) {
    console.error("[places] getLocalPlaces failure", {
      city: location.city,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
