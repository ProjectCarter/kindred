import test from "node:test";
import assert from "node:assert/strict";
import type { RankedDiscoveryItem } from "./discovery.ts";
import {
  FOOD_DRINK_GUIDE_COLLECTIONS,
  FOOD_DRINK_COLLECTION_SPREAD_ORDER,
  countRestaurantsFallbackFromLegacySpecialty,
  inferFoodDrinkCollection,
  summarizeFoodDrinkCollectionCounts,
} from "./foodDrinkCollections.ts";
import { buildFoodDrinkGuidePool } from "./foodDrinkSeeAll.ts";
import { curateFoodDrinkEdition } from "./foodDrinkCuration.ts";
import { HOMEPAGE_INITIAL_RENDER_COUNT } from "./editorialPublishing.ts";
function row(
  title: string,
  category: RankedDiscoveryItem["item"]["category"],
  scoreOrExtra: number | Partial<RankedDiscoveryItem["item"]> = 80,
  extra?: Partial<RankedDiscoveryItem["item"]>
): RankedDiscoveryItem {
  const score =
    typeof scoreOrExtra === "number" ? scoreOrExtra : 80;
  const itemExtra =
    typeof scoreOrExtra === "number" ? extra : scoreOrExtra;
  return {
    score,
    surfaces: [],
    reasons: [],
    item: {
      id: title.toLowerCase().replace(/\s+/g, "-"),
      title,
      dek: `${title} dek`,
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
      ...itemExtra,
    },
  } as RankedDiscoveryItem;
}

test("seven editorial collections are defined in display order", () => {
  assert.equal(FOOD_DRINK_GUIDE_COLLECTIONS.length, 7);
  assert.deepEqual(
    FOOD_DRINK_GUIDE_COLLECTIONS.map((c) => c.id),
    [
      "restaurants",
      "mexican",
      "asian",
      "pizza",
      "coffee_cafes",
      "breweries_wine",
      "desserts_bakeries",
    ]
  );
});

test("homepage spread prioritizes specialty collections before Restaurants", () => {
  assert.deepEqual(FOOD_DRINK_COLLECTION_SPREAD_ORDER, [
    "mexican",
    "asian",
    "pizza",
    "coffee_cafes",
    "breweries_wine",
    "desserts_bakeries",
    "restaurants",
  ]);
  assert.equal(
    FOOD_DRINK_COLLECTION_SPREAD_ORDER.at(-1),
    "restaurants"
  );
});

test("high-confidence specialties map to their collection", () => {
  assert.equal(
    inferFoodDrinkCollection(row("La Taqueria", "restaurants").item),
    "mexican"
  );
  assert.equal(
    inferFoodDrinkCollection(row("Sushi House", "restaurants").item),
    "asian"
  );
  assert.equal(
    inferFoodDrinkCollection(row("Tony Pizza", "restaurants").item),
    "pizza"
  );
  assert.equal(
    inferFoodDrinkCollection(row("Joe Coffee House", "coffee").item),
    "coffee_cafes"
  );
  assert.equal(
    inferFoodDrinkCollection(row("Desert Eagle Brewing", "restaurants", {
      dek: "Craft brewery and taproom",
    }).item),
    "breweries_wine"
  );
  assert.equal(
    inferFoodDrinkCollection(row("Rise Bakery", "bakeries").item),
    "desserts_bakeries"
  );
});

test("ambiguous venues stay in Restaurants", () => {
  assert.equal(
    inferFoodDrinkCollection(row("Steak Room", "restaurants").item),
    "restaurants"
  );
  assert.equal(
    inferFoodDrinkCollection(row("Mediterranean Grill", "restaurants").item),
    "restaurants"
  );
  assert.equal(
    inferFoodDrinkCollection(row("Burger Barn", "restaurants").item),
    "restaurants"
  );
});

test("each restaurant maps to exactly one collection", () => {
  const pool = [
    row("Joe Coffee", "coffee"),
    row("Rise Bakery", "bakeries"),
    row("Tony Pizza", "restaurants"),
    row("La Taqueria", "restaurants"),
    row("Sushi House", "restaurants"),
    row("Steak Room", "restaurants"),
    row("Brew Lab", "restaurants", { dek: "Local brewery taproom" }),
    row("Generic Kitchen", "restaurants"),
  ];
  const collections = pool.map((item) => inferFoodDrinkCollection(item.item));
  assert.equal(new Set(collections).size, new Set(collections).size);
  assert.equal(collections.length, pool.length);
});

test("collection counts on representative pool", () => {
  const pool = [
    row("Joe Coffee", "coffee"),
    row("Rise Bakery", "bakeries"),
    row("Tony Pizza", "restaurants"),
    row("La Taqueria", "restaurants"),
    row("Sushi House", "restaurants"),
    row("Prime Steakhouse", "restaurants"),
    row("Mediterranean Grill", "restaurants"),
    row("Brew Lab", "restaurants", { dek: "Craft brewery taproom" }),
    row("Generic Kitchen", "restaurants"),
    row("Another Kitchen", "restaurants"),
  ];
  const counts = summarizeFoodDrinkCollectionCounts(pool);
  assert.deepEqual(counts, {
    restaurants: 4,
    mexican: 1,
    asian: 1,
    pizza: 1,
    coffee_cafes: 1,
    breweries_wine: 1,
    desserts_bakeries: 1,
  });

  const legacySpecialty = (item: RankedDiscoveryItem["item"]) =>
    /\b(steakhouse|mediterranean|italian|vegetarian|bbq|burgers|breakfast|lunch)\b/i.test(
      `${item.title} ${item.dek ?? ""}`
    );
  assert.equal(
    countRestaurantsFallbackFromLegacySpecialty(pool, legacySpecialty),
    2
  );
});

test("guide pool includes all qualifying places without an artificial cap", () => {
  const pool = Array.from({ length: 30 }, (_, i) =>
    row(`Restaurant ${i}`, "restaurants")
  );
  assert.equal(buildFoodDrinkGuidePool(pool).length, 30);
});

test("homepage curation respects collection variety", () => {
  const pool = [
    row("Joe Coffee", "coffee", 95),
    row("Second Coffee", "coffee", 94),
    row("Rise Bakery", "bakeries", 93),
    row("Tony Pizza", "restaurants", 92),
    row("La Taqueria", "restaurants", 91),
    row("Sushi House", "restaurants", 90),
    row("Burger Barn", "restaurants", 89),
    row("Prime Steakhouse", "restaurants", 88),
    row("Sweet Desserts", "bakeries", 87),
  ];

  const curated = curateFoodDrinkEdition(pool, {
    depth: HOMEPAGE_INITIAL_RENDER_COUNT,
    maxPerFingerprint: 1,
    repeatScoreGap: Number.POSITIVE_INFINITY,
    getScore: (r) => r.score,
  });
  assert.ok(curated.length <= HOMEPAGE_INITIAL_RENDER_COUNT);
  for (const collection of [
    "coffee_cafes",
    "desserts_bakeries",
    "pizza",
    "mexican",
    "asian",
  ] as const) {
    const count = curated.filter(
      (r) => inferFoodDrinkCollection(r.item) === collection
    ).length;
    assert.ok(count <= 1, `expected at most one ${collection}, got ${count}`);
  }
});
