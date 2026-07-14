/**
 * Public entry point for the local-places integration.
 * Everything else (Edge Functions, Discovery Engine) should only ever
 * import from here — never reach into cache.ts or foursquareProvider.ts
 * directly. That's what keeps the provider swappable.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getCachedPlaces } from "./cache.ts";
import type {
  NormalizedPlace,
  PlacesCategory,
  PlacesLocation,
} from "./types.ts";

export type { NormalizedPlace, PlacesCategory, PlacesLocation } from "./types.ts";

/** Every desk Recommendations covers with verified place data ("where should I go?"). */
export const RECOMMENDATION_PLACES_CATEGORIES: PlacesCategory[] = [
  "coffee",
  "restaurants",
  "parks",
  "museums",
  "bookstores",
  "scenic_drives",
  "attractions",
  "bakeries",
  "gardens",
  "beaches",
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
];

/** Full roster fetched per metro — Recommendations + Activities combined. */
export const ALL_PLACES_CATEGORIES: PlacesCategory[] = [
  ...RECOMMENDATION_PLACES_CATEGORIES,
  ...ACTIVITY_PLACES_CATEGORIES,
];

/**
 * Fetch verified local places for a metro across every category, sharing
 * the cache with every other reader in that metro. Categories are fetched
 * in parallel; each one independently hits cache or (rarely) refreshes.
 */
export async function getLocalPlaces(
  admin: SupabaseClient,
  location: PlacesLocation,
  categories: PlacesCategory[] = ALL_PLACES_CATEGORIES
): Promise<NormalizedPlace[]> {
  if (!location.city || location.city === "your area") return [];

  try {
    const results = await Promise.all(
      categories.map((category) => getCachedPlaces(admin, location, category))
    );
    return results.flat();
  } catch (err) {
    console.error("[places] getLocalPlaces failure", {
      city: location.city,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
