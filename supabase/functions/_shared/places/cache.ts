/**
 * Shared, per-metro places cache with a single-flight refresh claim.
 *
 * This is the entire cost-control mechanism for the places integration:
 *
 *  - Cache key is (metro_key, category) — never the user, never lat/lon
 *    precisely. Every reader in "Gilbert, AZ" asking for coffee shops
 *    hits the exact same row.
 *  - Fresh cache (< REFRESH_INTERVAL_DAYS old) is served with zero
 *    provider calls, no matter how many readers ask.
 *  - When a row is stale, exactly one caller "claims" the refresh via an
 *    atomic `UPDATE ... WHERE refreshing = false RETURNING *`. Postgres
 *    row-level locking guarantees only one concurrent request can win
 *    that race. Everyone else — even 10,000 simultaneous readers — just
 *    reads the (slightly stale but still real) cached payload instead of
 *    also calling the provider. This is what makes cost roughly flat per
 *    city regardless of how many users open Kindred there.
 *  - A refresh that crashes mid-flight clears its own claim in a
 *    `finally`; as a backstop, a claim older than CLAIM_TIMEOUT_MINUTES
 *    is treated as abandoned and can be re-claimed.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { createFoursquareProvider } from "./foursquareProvider.ts";
import { writeEditorialNotesForPlaces } from "./notes.ts";
import type {
  NormalizedPlace,
  PlacesCategory,
  PlacesLocation,
  PlacesProvider,
} from "./types.ts";

/** Food & Drink and Activities use shared catalogs — never this cache. */
const FOOD_DRINK_CATEGORIES = new Set<PlacesCategory>([
  "coffee",
  "restaurants",
  "bakeries",
]);

const ACTIVITY_CATEGORIES = new Set<PlacesCategory>([
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
  "parks",
  "museums",
  "scenic_drives",
  "gardens",
  "beaches",
  "attractions",
]);

/** Places don't turn over often — a week-old cache is still accurate. */
const REFRESH_INTERVAL_DAYS = 7;
/** Backstop for a refresh that crashed without clearing its own claim. */
const CLAIM_TIMEOUT_MINUTES = 3;

type CacheRow = {
  id: string;
  metro_key: string;
  places: NormalizedPlace[];
  fetched_at: string;
};

function metroKey(location: PlacesLocation): string {
  const state = location.state?.trim() || location.region?.trim() || "";
  const raw = `${location.city.trim()}-${state}`.toLowerCase();
  return raw
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Provider abstraction point — swap or add Google Places here only. */
function activeProvider(): PlacesProvider {
  return createFoursquareProvider();
}

/**
 * Get places for one metro + category, refreshing the shared cache at
 * most once per REFRESH_INTERVAL_DAYS regardless of concurrent readers.
 */
export async function getCachedPlaces(
  admin: SupabaseClient,
  location: PlacesLocation,
  category: PlacesCategory
): Promise<NormalizedPlace[]> {
  if (FOOD_DRINK_CATEGORIES.has(category) || ACTIVITY_CATEGORIES.has(category)) {
    return [];
  }

  const provider = activeProvider();
  // No key configured yet — never touch the cache table. Writing a
  // placeholder row here would look "fresh" for a full week once a real
  // key is finally added, silently delaying activation. Zero-cost no-op
  // instead: nothing to cache, nothing spent.
  if (!provider.isConfigured) {
    return [];
  }

  const key = metroKey(location);

  const { data: existing, error: readError } = await admin
    .from("local_places_cache")
    .select("id, metro_key, places, fetched_at, refreshing, refreshing_since")
    .eq("metro_key", key)
    .eq("category", category)
    .maybeSingle();

  if (readError) {
    console.error("[places:cache] read failure", {
      key,
      category,
      error: readError.message,
    });
    return [];
  }

  const now = Date.now();
  const freshCutoff = now - REFRESH_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
  const claimTimeoutCutoff = now - CLAIM_TIMEOUT_MINUTES * 60 * 1000;

  if (existing) {
    const fetchedAtMs = new Date(existing.fetched_at).getTime();
    const isFresh = fetchedAtMs >= freshCutoff;
    if (isFresh) {
      console.log("[places:cache] hit (fresh)", { key, category });
      return (existing.places as NormalizedPlace[]) ?? [];
    }

    // Stale — try to claim the refresh. Someone else may already hold it.
    const refreshingSinceMs = existing.refreshing_since
      ? new Date(existing.refreshing_since as string).getTime()
      : 0;
    const claimAbandoned =
      !existing.refreshing || refreshingSinceMs < claimTimeoutCutoff;

    if (!claimAbandoned) {
      console.log("[places:cache] stale but another request is refreshing", {
        key,
        category,
      });
      return (existing.places as NormalizedPlace[]) ?? [];
    }

    const { data: claimed, error: claimError } = await admin
      .from("local_places_cache")
      .update({ refreshing: true, refreshing_since: new Date().toISOString() })
      .eq("id", existing.id)
      .or(
        `refreshing.eq.false,refreshing_since.lt.${new Date(
          claimTimeoutCutoff
        ).toISOString()}`
      )
      .select("id")
      .maybeSingle();

    if (claimError || !claimed) {
      console.log("[places:cache] lost refresh claim race — serving stale", {
        key,
        category,
      });
      return (existing.places as NormalizedPlace[]) ?? [];
    }

    return await refreshAndStore(admin, existing.id, location, category, provider);
  }

  // No row yet — try to create one. `on conflict do nothing` means a
  // concurrent first-request race produces exactly one winner; the loser
  // just re-reads whatever the winner ends up writing (or an empty
  // placeholder if it hasn't finished yet — resolved on the next read).
  const { data: inserted, error: insertError } = await admin
    .from("local_places_cache")
    .insert({
      metro_key: key,
      city: location.city,
      region: location.region ?? null,
      state: location.state ?? null,
      category,
      provider: provider.name,
      places: [],
      refreshing: true,
      refreshing_since: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (insertError || !inserted) {
    console.log("[places:cache] lost create race — re-reading", {
      key,
      category,
      error: insertError?.message,
    });
    const { data: raced } = await admin
      .from("local_places_cache")
      .select("places")
      .eq("metro_key", key)
      .eq("category", category)
      .maybeSingle();
    return (raced?.places as NormalizedPlace[]) ?? [];
  }

  return await refreshAndStore(admin, inserted.id, location, category, provider);
}

async function refreshAndStore(
  admin: SupabaseClient,
  rowId: string,
  location: PlacesLocation,
  category: PlacesCategory,
  provider: PlacesProvider
): Promise<NormalizedPlace[]> {
  try {
    if (!provider.isConfigured) {
      console.log("[places:cache] provider not configured — no refresh", {
        provider: provider.name,
        category,
      });
      return [];
    }

    const { places: rawPlaces, candidateCount, uniqueCount, pageCount } =
      await provider.search(location, category);
    const places = await writeEditorialNotesForPlaces(
      rawPlaces,
      category,
      location.city
    );

    await admin
      .from("local_places_cache")
      .update({
        places,
        candidate_count: candidateCount,
        fetched_at: new Date().toISOString(),
        refreshing: false,
        refreshing_since: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", rowId);

    console.log("[places:cache] refreshed", {
      category,
      city: location.city,
      pageCount,
      rawCandidateCount: candidateCount,
      uniquePlaceCount: uniqueCount,
      placeCount: places.length,
    });

    return places;
  } catch (err) {
    console.error("[places:cache] refresh failure — clearing claim", {
      category,
      city: location.city,
      error: err instanceof Error ? err.message : String(err),
    });
    await admin
      .from("local_places_cache")
      .update({ refreshing: false, refreshing_since: null })
      .eq("id", rowId);
    return [];
  }
}
