import test from "node:test";
import assert from "node:assert/strict";
import {
  mergePlacesByProviderId,
  parseFoursquareNextPageUrl,
} from "../../supabase/functions/_shared/places/foursquarePagination.ts";

test("parseFoursquareNextPageUrl reads rel=next from Link header", () => {
  const url = parseFoursquareNextPageUrl(
    '<https://places-api.foursquare.com/places/search?cursor=abc>; rel="next", <https://places-api.foursquare.com/places/search?cursor=zzz>; rel="last"'
  );
  assert.equal(
    url,
    "https://places-api.foursquare.com/places/search?cursor=abc"
  );
});

test("mergePlacesByProviderId keeps first page order and dedupes ids", () => {
  const base = {
    category: "coffee" as const,
    address: null,
    city: null,
    state: null,
    lat: null,
    lon: null,
    url: null,
    providerCategories: [],
    rating: null,
    priceTier: null,
  };
  const a = { ...base, providerId: "fsq-1", name: "A" };
  const b = { ...base, providerId: "fsq-2", name: "B" };
  const dupe = { ...base, providerId: "fsq-1", name: "A duplicate" };

  const merged = mergePlacesByProviderId([a], [dupe, b]);
  assert.deepEqual(
    merged.map((p) => p.providerId),
    ["fsq-1", "fsq-2"]
  );
  assert.equal(merged[0]?.name, "A");
});
