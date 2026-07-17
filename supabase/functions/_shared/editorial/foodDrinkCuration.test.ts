import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { RankedDiscoveryItem } from "../discovery/types.ts";
import {
  curateFoodDrinkEdition,
  inferFoodEditorFingerprint,
  resolveFoodChainKey,
} from "./foodDrinkCuration.ts";

function row(
  title: string,
  category: RankedDiscoveryItem["item"]["category"],
  extra?: Partial<RankedDiscoveryItem["item"]>
): RankedDiscoveryItem {
  return {
    score: 80,
    surfaces: [],
    reasons: [],
    item: {
      id: title.toLowerCase().replace(/\s+/g, "-"),
      title,
      dek: "",
      category,
      family: "food_drink",
      tags: ["local_place"],
      venueCategories: [],
      seasons: [],
      weatherFit: [],
      popularity: 0.5,
      uniqueness: 0.5,
      localExpertise: 0.7,
      quality: 0.8,
      source: { name: "Foursquare", tier: "local", url: null },
      place: { city: "Gilbert", region: "AZ" },
      lat: 33.35,
      lon: -111.79,
      address: "Gilbert, AZ",
      ...extra,
    } as unknown as RankedDiscoveryItem["item"],
  } as unknown as RankedDiscoveryItem;
}

Deno.test("inferFoodEditorFingerprint classifies cuisine types", () => {
  assertEquals(
    inferFoodEditorFingerprint(row("Joe's Coffee House", "coffee").item),
    "coffee_shop"
  );
  assertEquals(
    inferFoodEditorFingerprint(row("Rise Bakery", "bakeries").item),
    "bakery"
  );
  assertEquals(
    inferFoodEditorFingerprint(row("La Taqueria", "restaurants").item),
    "mexican"
  );
});

Deno.test("curateFoodDrinkEdition spreads fingerprints across the desk", () => {
  const pool = [
    row("Best Coffee A", "coffee"),
    row("Second Coffee B", "coffee"),
    row("Morning Bagels Bakery", "bakeries"),
    row("Tony's Pizza", "restaurants"),
    row("Desert Brewery", "restaurants", { venueCategories: ["Brewery"] }),
  ];
  pool[0]!.score = 95;
  pool[1]!.score = 94;

  const curated = curateFoodDrinkEdition(pool, { depth: 4, getScore: (r) => r.score });
  const fps = curated.slice(0, 4).map((r) => inferFoodEditorFingerprint(r.item));
  assertEquals(new Set(fps).size, 4);
});

Deno.test("resolveFoodChainKey keeps one Starbucks per edition", () => {
  const a = row("Starbucks - Gilbert Rd", "coffee", { tags: ["chain", "local_place"] });
  const b = row("Starbucks - San Tan Village", "coffee", { tags: ["chain", "local_place"] });
  assertEquals(resolveFoodChainKey(a.item), "starbucks");
  const curated = curateFoodDrinkEdition([a, b], { depth: 2, getScore: () => 80 });
  assertEquals(curated.length, 1);
});
