import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  mergePlacesByProviderId,
  parseFoursquareNextPageUrl,
} from "./foursquarePagination.ts";
import type { NormalizedPlace } from "./types.ts";

Deno.test("parseFoursquareNextPageUrl reads rel=next from Link header", () => {
  const url = parseFoursquareNextPageUrl(
    '<https://places-api.foursquare.com/places/search?cursor=abc>; rel="next", <https://places-api.foursquare.com/places/search?cursor=zzz>; rel="last"'
  );
  assertEquals(url, "https://places-api.foursquare.com/places/search?cursor=abc");
});

Deno.test("mergePlacesByProviderId keeps first page order and dedupes ids", () => {
  const a: NormalizedPlace = {
    providerId: "fsq-1",
    name: "A",
    category: "coffee",
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
  const b: NormalizedPlace = { ...a, providerId: "fsq-2", name: "B" };
  const dupe: NormalizedPlace = { ...a, name: "A duplicate" };

  const merged = mergePlacesByProviderId([a], [dupe, b]);
  assertEquals(merged.map((p) => p.providerId), ["fsq-1", "fsq-2"]);
  assertEquals(merged[0]?.name, "A");
});
