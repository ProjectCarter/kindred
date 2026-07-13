/**
 * Foursquare Places API adapter (current API — the legacy /v3/ endpoints
 * were deprecated May 15, 2026; this targets places-api.foursquare.com
 * with Service Key bearer auth, per Foursquare's 2026 migration guide).
 *
 * Cost-minimization choices baked in on purpose:
 *  - Requests ONLY Foursquare's free "Pro" fields (fsq_place_id, name,
 *    latitude, longitude, location, link, categories). Hours, rating,
 *    price, photos, tips, and popularity are Premium-tier fields billed
 *    from the very first call, with no free tier at all — Kindred never
 *    asks for them, so it can never be billed for them. If a field isn't
 *    returned, the NormalizedPlace value is left null rather than
 *    invented (never fabricate a rating or price).
 *  - One search call = one category in one metro. The caller (cache.ts)
 *    is responsible for making sure this only ever runs once per metro
 *    per refresh window, no matter how many readers are asking.
 *  - Plain-language `query` text instead of memorized taxonomy IDs for
 *    categories Foursquare doesn't have a single clean category for
 *    (scenic drives, attractions) — more robust than guessing category
 *    IDs, and Foursquare's search ranking already handles this well.
 */

import type {
  NormalizedPlace,
  PlacesCategory,
  PlacesLocation,
  PlacesProvider,
  PlacesSearchResult,
} from "./types.ts";

const FOURSQUARE_SEARCH_URL = "https://places-api.foursquare.com/places/search";
const API_VERSION = "2025-06-17";
// Pro fields only — see file header. Never add hours/rating/price/photos/
// tips/popularity here without re-checking Foursquare's current billing
// tier for that field.
const PRO_FIELDS = "fsq_place_id,name,latitude,longitude,location,link,categories";
const SEARCH_RADIUS_METERS = 16_000; // ~10 miles — a metro, not a block
const RESULT_LIMIT = 50; // API max — one call, as many candidates as possible

/**
 * Query text + a verified Foursquare category id (the current FSQ OS
 * Places taxonomy uses 24-char hex ids — NOT the short numeric ids from
 * the legacy v2/v3 API). Each id below was confirmed live against
 * places-api.foursquare.com before shipping — an invalid id makes the
 * whole search 400, so this list is exact, not a best guess:
 *   Coffee Shop / Café      4bf58dd8d48988d1e0931735 / …d16d941735
 *   Restaurant (umbrella)   4d4b7105d754a06374d81259
 *   Park                    4bf58dd8d48988d163941735
 *   Museum                  4bf58dd8d48988d181941735
 *   Bookstore               4bf58dd8d48988d114951735
 *   Scenic Lookout          4bf58dd8d48988d165941735
 *   Monument / Historic Site 4bf58dd8d48988d12d941735 / 4deefb944765f83613cdba6e
 * `query` still matters even with a category id filter — it's how a
 * general "Restaurant" category id search still ranks by relevance
 * instead of returning an arbitrary alphabetical slice.
 */
const CATEGORY_QUERY: Record<
  PlacesCategory,
  { query: string; categoryIds: string[] }
> = {
  coffee: {
    query: "coffee shop",
    categoryIds: ["4bf58dd8d48988d1e0931735", "4bf58dd8d48988d16d941735"],
  },
  restaurants: {
    query: "restaurant",
    categoryIds: ["4d4b7105d754a06374d81259"],
  },
  parks: {
    query: "park",
    categoryIds: ["4bf58dd8d48988d163941735"],
  },
  museums: {
    query: "museum",
    categoryIds: ["4bf58dd8d48988d181941735"],
  },
  bookstores: {
    query: "bookstore",
    categoryIds: ["4bf58dd8d48988d114951735"],
  },
  // "Scenic overlook/viewpoint" wording — deliberately avoids the word
  // "drive", which false-matched drive-thru chains like Sonic Drive-In.
  scenic_drives: {
    query: "scenic overlook viewpoint",
    categoryIds: ["4bf58dd8d48988d165941735"],
  },
  attractions: {
    query: "landmark monument historic site",
    categoryIds: ["4bf58dd8d48988d12d941735", "4deefb944765f83613cdba6e"],
  },
};

function toNormalizedPlace(
  raw: unknown,
  category: PlacesCategory
): NormalizedPlace | null {
  if (!raw || typeof raw !== "object") return null;
  const place = raw as {
    fsq_place_id?: string;
    name?: string;
    link?: string;
    latitude?: number;
    longitude?: number;
    categories?: Array<{ name?: string }>;
    location?: {
      formatted_address?: string;
      locality?: string;
      address?: string;
      region?: string;
    };
  };

  const providerId = place.fsq_place_id?.trim();
  const name = place.name?.trim();
  if (!providerId || !name) return null;

  const address =
    place.location?.formatted_address?.trim() ||
    place.location?.address?.trim() ||
    null;

  return {
    providerId,
    name,
    category,
    address,
    city: place.location?.locality?.trim() || null,
    lat: typeof place.latitude === "number" ? place.latitude : null,
    lon: typeof place.longitude === "number" ? place.longitude : null,
    url: place.link ? `https://foursquare.com${place.link}` : null,
    providerCategories: (place.categories ?? [])
      .map((c) => c.name?.trim())
      .filter((c): c is string => Boolean(c)),
    rating: null, // Premium field — never requested, never fabricated.
    priceTier: null, // Premium field — never requested, never fabricated.
  };
}

export function createFoursquareProvider(): PlacesProvider {
  const apiKey = Deno.env.get("FOURSQUARE_API_KEY") ?? "";

  return {
    name: "foursquare",
    isConfigured: Boolean(apiKey),

    async search(
      location: PlacesLocation,
      category: PlacesCategory
    ): Promise<PlacesSearchResult> {
      if (!apiKey) {
        console.log("[places:foursquare] search skipped", {
          reason: "FOURSQUARE_API_KEY not set",
          category,
        });
        return { places: [], candidateCount: 0 };
      }

      const spec = CATEGORY_QUERY[category];
      const params = new URLSearchParams({
        ll: `${location.lat},${location.lon}`,
        radius: String(SEARCH_RADIUS_METERS),
        query: spec.query,
        limit: String(RESULT_LIMIT),
        fields: PRO_FIELDS,
        sort: "RELEVANCE",
      });
      params.set("fsq_category_ids", spec.categoryIds.join(","));

      try {
        const res = await fetch(`${FOURSQUARE_SEARCH_URL}?${params}`, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "X-Places-Api-Version": API_VERSION,
            Accept: "application/json",
          },
        });

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          console.error("[places:foursquare] search HTTP error", {
            status: res.status,
            category,
            city: location.city,
            body: body.slice(0, 300),
          });
          return { places: [], candidateCount: 0 };
        }

        const data = (await res.json()) as { results?: unknown[] };
        const rawResults = Array.isArray(data.results) ? data.results : [];
        const places = rawResults
          .map((r) => toNormalizedPlace(r, category))
          .filter((p): p is NormalizedPlace => Boolean(p));

        console.log("[places:foursquare] search ok", {
          category,
          city: location.city,
          candidateCount: rawResults.length,
          normalizedCount: places.length,
        });

        return { places, candidateCount: rawResults.length };
      } catch (err) {
        console.error("[places:foursquare] search failure", {
          category,
          city: location.city,
          error: err instanceof Error ? err.message : String(err),
        });
        return { places: [], candidateCount: 0 };
      }
    },
  };
}
