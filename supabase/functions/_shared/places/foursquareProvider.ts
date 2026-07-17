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

import { composeVerifiedAddress } from "./addressValidation.ts";
import {
  FOURSQUARE_MAX_PAGES,
  mergePlacesByProviderId,
  parseFoursquareNextPageUrl,
  type FoursquarePaginationStats,
} from "./foursquarePagination.ts";
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
const SEARCH_RADIUS_METERS = 40_234; // ~25 miles — matches KINDRED_LOCAL_RADIUS
const RESULT_LIMIT = 50; // API max per page — paginate until exhausted

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
 *
 * Activities desk category ids below (bowling, mini_golf, rock_climbing,
 * go_karts, arcades, laser_tag, paintball, billiards, roller_skating,
 * ice_skating, karaoke, batting_cages) were cross-checked against two
 * independent public sources of Foursquare's category taxonomy and match
 * ids already confirmed live elsewhere in this file (coffee, museum, park,
 * etc.) — same hex id space, so they're trusted the same way.
 *
 * water_recreation/escape_rooms/axe_throwing/pickleball and
 * bakeries/gardens/beaches remain deliberately `categoryIds: []` — the same
 * choice already made for scenic_drives/attractions. No verified hex id was
 * found for these in Foursquare's published taxonomy (they may simply not
 * have a dedicated category yet). Plain-language `query` text alone is
 * still reasonable for categories this specific.
 *
 * Belt-and-suspenders: `search()` below automatically retries once without
 * `fsq_category_ids` if the API 400s, so even a category id that turns out
 * to be wrong degrades to a text-only search instead of silently returning
 * nothing for that entire category.
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
  bakeries: {
    query: "bakery",
    categoryIds: [],
  },
  gardens: {
    query: "botanical garden",
    categoryIds: [],
  },
  beaches: {
    query: "beach",
    categoryIds: [],
  },
  water_recreation: {
    query: "kayak rental paddleboard rental",
    categoryIds: ["63be6904847c3692a84b9c1d"], // Canoe and Kayak Rentals
  },
  escape_rooms: {
    query: "escape room",
    categoryIds: [],
  },
  bowling: {
    query: "bowling alley",
    categoryIds: ["4bf58dd8d48988d1e4931735"], // Bowling Alley
  },
  mini_golf: {
    query: "mini golf",
    categoryIds: ["52e81612bcbc57f1066b79eb"], // Mini Golf
  },
  rock_climbing: {
    query: "rock climbing gym",
    categoryIds: ["503289d391d4c4b30a586d6a"], // Climbing Gym
  },
  axe_throwing: {
    query: "axe throwing",
    categoryIds: [],
  },
  go_karts: {
    query: "go kart racing",
    categoryIds: ["52e81612bcbc57f1066b79ea"], // Go Kart Track
  },
  pickleball: {
    query: "pickleball courts",
    categoryIds: [],
  },
  arcades: {
    query: "arcade",
    categoryIds: ["4bf58dd8d48988d1e1931735"], // Arcade
  },
  laser_tag: {
    query: "laser tag",
    categoryIds: ["52e81612bcbc57f1066b79e6"], // Laser Tag
  },
  paintball: {
    query: "paintball",
    categoryIds: ["5032829591d4c4b30a586d5e"], // Paintball Field
  },
  billiards: {
    query: "billiards pool hall",
    categoryIds: ["4bf58dd8d48988d1e3931735"], // Pool Hall
  },
  roller_skating: {
    query: "roller skating rink",
    categoryIds: ["52e81612bcbc57f1066b79e9"], // Roller Rink
  },
  ice_skating: {
    query: "ice skating rink",
    categoryIds: ["4bf58dd8d48988d168941735"], // Skating Rink
  },
  karaoke: {
    query: "karaoke bar",
    categoryIds: ["4bf58dd8d48988d120941735"], // Karaoke Bar
  },
  batting_cages: {
    query: "batting cages",
    categoryIds: ["63be6904847c3692a84b9c00"], // Batting Cages
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

  const city = place.location?.locality?.trim() || null;
  const state = place.location?.region?.trim() || null;
  const address = composeVerifiedAddress({
    formatted: place.location?.formatted_address,
    street: place.location?.address,
    city,
    region: state,
    state,
  });

  return {
    providerId,
    name,
    category,
    address,
    city,
    state,
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

type SearchPageResult =
  | {
      ok: true;
      places: NormalizedPlace[];
      rawCount: number;
      nextUrl: string | null;
    }
  | { ok: false; status: number };

async function fetchSearchPage(
  apiKey: string,
  url: string,
  category: PlacesCategory
): Promise<SearchPageResult> {
  const res = await fetch(url, {
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
      url: url.slice(0, 180),
      body: body.slice(0, 300),
    });
    return { ok: false, status: res.status };
  }

  const data = (await res.json()) as { results?: unknown[] };
  const rawResults = Array.isArray(data.results) ? data.results : [];
  const places = rawResults
    .map((r) => toNormalizedPlace(r, category))
    .filter((p): p is NormalizedPlace => Boolean(p));

  return {
    ok: true,
    places,
    rawCount: rawResults.length,
    nextUrl: parseFoursquareNextPageUrl(res.headers.get("link")),
  };
}

/** Daily incremental scan — stop after N consecutive pages with no new provider IDs. */
export const FOURSQUARE_INCREMENTAL_KNOWN_PAGE_STOP = 2;
/** Daily incremental scan — hard cap on pages per category. */
export const FOURSQUARE_INCREMENTAL_MAX_PAGES = 12;

export type CatalogSearchMode = "full" | "incremental";

export type CatalogSearchStats = FoursquarePaginationStats & {
  apiCalls: number;
};

export type CatalogSearchOptions = {
  mode: CatalogSearchMode;
  /** Provider IDs already in the metro catalog — used for incremental early-stop. */
  knownProviderIds?: ReadonlySet<string>;
  withCategoryIds?: boolean;
};

/** Paginated Foursquare search for catalog sync (full or incremental). */
export async function searchFoursquareCategory(
  category: PlacesCategory,
  location: PlacesLocation,
  options: CatalogSearchOptions
): Promise<{ places: NormalizedPlace[]; stats: CatalogSearchStats }> {
  const apiKey = Deno.env.get("FOURSQUARE_API_KEY") ?? "";
  if (!apiKey) {
    return {
      places: [],
      stats: {
        pageCount: 0,
        rawResultCount: 0,
        uniquePlaceCount: 0,
        stoppedReason: "error",
        apiCalls: 0,
      },
    };
  }

  const withCategoryIds = options.withCategoryIds ?? true;
  let result = await searchAllPages(apiKey, category, location, withCategoryIds, options);

  if (
    result.stats.stoppedReason === "error" &&
    withCategoryIds &&
    CATEGORY_QUERY[category].categoryIds.length > 0
  ) {
    result = await searchAllPages(apiKey, category, location, false, options);
  }

  return result;
}

async function searchAllPages(
  apiKey: string,
  category: PlacesCategory,
  location: PlacesLocation,
  withCategoryIds: boolean,
  catalogOptions?: CatalogSearchOptions
): Promise<{ places: NormalizedPlace[]; stats: CatalogSearchStats }> {
  const spec = CATEGORY_QUERY[category];

  function buildInitialUrl(): string {
    const params = new URLSearchParams({
      ll: `${location.lat},${location.lon}`,
      radius: String(SEARCH_RADIUS_METERS),
      query: spec.query,
      limit: String(RESULT_LIMIT),
      fields: PRO_FIELDS,
      sort: "RELEVANCE",
    });
    if (withCategoryIds && spec.categoryIds.length > 0) {
      params.set("fsq_category_ids", spec.categoryIds.join(","));
    }
    return `${FOURSQUARE_SEARCH_URL}?${params.toString()}`;
  }

  let merged: NormalizedPlace[] = [];
  let nextUrl: string | null = buildInitialUrl();
  let pageCount = 0;
  let apiCalls = 0;
  let rawResultCount = 0;
  let stoppedReason: FoursquarePaginationStats["stoppedReason"] = "complete";
  const mode = catalogOptions?.mode ?? "full";
  const knownIds = catalogOptions?.knownProviderIds ?? new Set<string>();
  let consecutiveKnownPages = 0;
  const maxPages =
    mode === "incremental"
      ? FOURSQUARE_INCREMENTAL_MAX_PAGES
      : FOURSQUARE_MAX_PAGES;

  while (nextUrl && pageCount < maxPages) {
    pageCount += 1;
    apiCalls += 1;
    const page = await fetchSearchPage(apiKey, nextUrl, category);
    if (!page.ok) {
      stoppedReason = "error";
      break;
    }

    rawResultCount += page.rawCount;

    if (mode === "incremental") {
      const newOnPage = page.places.filter((p) => !knownIds.has(p.providerId));
      merged = mergePlacesByProviderId(merged, page.places);
      for (const p of page.places) knownIds.add(p.providerId);
      if (newOnPage.length === 0) {
        consecutiveKnownPages += 1;
      } else {
        consecutiveKnownPages = 0;
      }
      if (consecutiveKnownPages >= FOURSQUARE_INCREMENTAL_KNOWN_PAGE_STOP) {
        stoppedReason = "complete";
        break;
      }
    } else {
      merged = mergePlacesByProviderId(merged, page.places);
    }

    if (page.rawCount === 0) {
      stoppedReason = "empty_page";
      break;
    }

    nextUrl = page.nextUrl;
    if (!nextUrl) {
      stoppedReason = "complete";
      break;
    }
  }

  if (pageCount >= maxPages && nextUrl) {
    stoppedReason = "max_pages";
    console.warn("[places:foursquare] pagination stopped at safety cap", {
      category,
      city: location.city,
      mode,
      pageCount,
      uniquePlaceCount: merged.length,
    });
  }

  return {
    places: merged,
    stats: {
      pageCount,
      rawResultCount,
      uniquePlaceCount: merged.length,
      stoppedReason,
      apiCalls,
    },
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

      try {
        const first = await searchFoursquareCategory(category, location, {
          mode: "full",
          withCategoryIds: true,
        });
        if (first.stats.stoppedReason !== "error") {
          console.log("[places:foursquare] search paginated ok", {
            category,
            city: location.city,
            withCategoryIds: true,
            ...first.stats,
          });
          return {
            places: first.places,
            candidateCount: first.stats.rawResultCount,
            uniqueCount: first.stats.uniquePlaceCount,
            pageCount: first.stats.pageCount,
          };
        }

        if (spec.categoryIds.length > 0) {
          console.warn("[places:foursquare] retrying pagination without category ids", {
            category,
            city: location.city,
          });
          const retry = await searchFoursquareCategory(category, location, {
            mode: "full",
            withCategoryIds: false,
          });
          console.log("[places:foursquare] search paginated ok", {
            category,
            city: location.city,
            withCategoryIds: false,
            ...retry.stats,
          });
          return {
            places: retry.places,
            candidateCount: retry.stats.rawResultCount,
            uniqueCount: retry.stats.uniquePlaceCount,
            pageCount: retry.stats.pageCount,
          };
        }

        return { places: [], candidateCount: 0, uniqueCount: 0, pageCount: 0 };
      } catch (err) {
        console.error("[places:foursquare] search failure", {
          category,
          city: location.city,
          error: err instanceof Error ? err.message : String(err),
        });
        return { places: [], candidateCount: 0, uniqueCount: 0, pageCount: 0 };
      }
    },
  };
}
