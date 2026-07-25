/**
 * Public entry point for the local-places integration.
 * Everything else (Edge Functions, Discovery Engine) should only ever
 * import from here — never reach into cache.ts or foursquareProvider.ts
 * directly. That's what keeps the provider swappable.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  EDITION_ACTIVITIES_READ_LIMIT,
  EDITION_FOOD_DRINK_READ_LIMIT,
} from "../editorial/publishing.ts";
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

const EDITION_ACTIVITY_SELECT =
  "id, provider_id, provider_category, name, address, city, state, lat, lon, url, provider_categories, price_level, editorial_teaser, note, editorial_article";

const EDITION_FOOD_SELECT =
  "id, provider_id, provider_category, name, address, city, state, lat, lon, url, provider_categories, price_level, editorial_teaser, note, editorial_article, editorial_score, editorial_labels";

/**
 * Edition read path — two bulk catalog queries instead of 25 category round trips.
 * Zero provider calls; reuses prebuilt market catalogs.
 */
export async function getLocalPlacesForEdition(
  admin: SupabaseClient,
  location: PlacesLocation,
  options?: { catalogMetroKey?: string | null }
): Promise<NormalizedPlace[]> {
  if (!location.city || location.city === "your area") return [];

  try {
    await registerFoodDrinkMetro(admin, location, options?.catalogMetroKey);
    await registerActivitiesMetro(admin, location, options?.catalogMetroKey);
    const metroKey = options?.catalogMetroKey?.trim();
    if (!metroKey) {
      console.warn("[places] edition read missing catalogMetroKey — refusing city-slug fallback");
      return [];
    }

    const [activitiesRes, foodRes] = await Promise.all([
      admin
        .from("activities_catalog")
        .select(EDITION_ACTIVITY_SELECT)
        .eq("metro_key", metroKey)
        .in("lifecycle", ["verified", "active", "featured"])
        .order("confidence_score", { ascending: false })
        .limit(EDITION_ACTIVITIES_READ_LIMIT),
      admin
        .from("food_drink_catalog")
        .select(EDITION_FOOD_SELECT)
        .eq("metro_key", metroKey)
        .eq("status", "active")
        .order("confidence_score", { ascending: false })
        .limit(EDITION_FOOD_DRINK_READ_LIMIT),
    ]);

    if (activitiesRes.error) {
      console.error("[places] edition activities read failure", activitiesRes.error);
    }
    if (foodRes.error) {
      console.error("[places] edition food read failure", foodRes.error);
    }

    const activityPlaces = (activitiesRes.data ?? []).map((row) => ({
      providerId: String(row.provider_id),
      name: String(row.name),
      category: row.provider_category as PlacesCategory,
      address: row.address as string | null,
      city: row.city as string | null,
      state: row.state as string | null,
      lat: row.lat as number | null,
      lon: row.lon as number | null,
      url: row.url as string | null,
      providerCategories: (row.provider_categories as string[] | null) ?? [],
      rating: null,
      priceTier: row.price_level as number | null,
      kindredVenueId: String(row.id),
      note: (row.editorial_teaser as string | null) ?? (row.note as string | null),
      about: (row.editorial_article as string | null) ?? null,
    }));

    const foodPlaces = (foodRes.data ?? []).map((row) => ({
      providerId: String(row.provider_id),
      name: String(row.name),
      category: row.provider_category as PlacesCategory,
      address: row.address as string | null,
      city: row.city as string | null,
      state: row.state as string | null,
      lat: row.lat as number | null,
      lon: row.lon as number | null,
      url: row.url as string | null,
      providerCategories: (row.provider_categories as string[] | null) ?? [],
      rating: null,
      priceTier: row.price_level as number | null,
      editorialScore: row.editorial_score as number | null | undefined,
      editorialLabels: (row.editorial_labels as string[] | null) ?? [],
      kindredVenueId: String(row.id),
      note: (row.editorial_teaser as string | null) ?? (row.note as string | null),
      about: (row.editorial_article as string | null) ?? null,
    }));

    const merged = dedupePlacesByProviderId([...activityPlaces, ...foodPlaces]);
    console.log("[places] edition catalog merged", {
      city: location.city,
      metroKey,
      uniquePlaces: merged.length,
      activities: activityPlaces.length,
      foodDrink: foodPlaces.length,
    });
    return merged;
  } catch (err) {
    console.error("[places] getLocalPlacesForEdition failure", {
      city: location.city,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
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

  if (categories.length === ALL_PLACES_CATEGORIES.length) {
    return getLocalPlacesForEdition(admin, location);
  }

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
