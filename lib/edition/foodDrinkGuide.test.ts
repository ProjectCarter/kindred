import test from "node:test";
import assert from "node:assert/strict";
import type { RankedDiscoveryItem } from "./discovery";
import { selectHomepageRecommendationCards } from "./recommendations";
import { organizeFoodDrinkGuide, foodDrinkGuidePlaceCount } from "./foodDrinkGuide";
import {
  curateFoodDrinkEdition,
  inferFoodEditorFingerprint,
} from "./foodDrinkCuration";
import { HOMEPAGE_INITIAL_RENDER_COUNT } from "./editorialPublishing";

function row(
  title: string,
  category: RankedDiscoveryItem["item"]["category"],
  score = 80
): RankedDiscoveryItem {
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
    },
  } as RankedDiscoveryItem;
}

test("homepage shows at most 8 featured restaurants", () => {
  const pool = [
    row("Joe Coffee", "coffee", 95),
    row("Rise Bakery", "bakeries", 94),
    row("Tony Pizza", "restaurants", 93),
    row("La Taqueria", "restaurants", 92),
    row("Sushi House", "restaurants", 91),
    row("Burger Barn", "restaurants", 90),
    row("Steak Room", "restaurants", 89),
    row("Sweet Desserts", "bakeries", 88),
    row("Extra Ninth", "restaurants", 87),
  ];

  const cards = selectHomepageRecommendationCards(pool);
  assert.ok(cards.length <= HOMEPAGE_INITIAL_RENDER_COUNT);
  assert.ok(cards.length >= 1);
});

test("homepage featured picks do not repeat cuisine fingerprints", () => {
  const pool = [
    row("Joe Coffee", "coffee", 95),
    row("Second Coffee", "coffee", 94),
    row("Rise Bakery", "bakeries", 93),
    row("Tony Pizza", "restaurants", 92),
    row("La Taqueria", "restaurants", 91),
    row("Sushi House", "restaurants", 90),
    row("Burger Barn", "restaurants", 89),
    row("Steak Room", "restaurants", 88),
    row("Sweet Desserts", "bakeries", 87),
  ];

  const curated = curateFoodDrinkEdition(pool, {
    depth: 8,
    maxPerFingerprint: 1,
    repeatScoreGap: Number.POSITIVE_INFINITY,
    getScore: (r) => r.score,
  });
  for (const fp of ["coffee_shop", "bakery", "pizza"] as const) {
    const count = curated.filter(
      (r) => inferFoodEditorFingerprint(r.item) === fp
    ).length;
    assert.ok(count <= 1, `expected at most one ${fp}, got ${count}`);
  }
});

test("guide includes all qualifying places without an artificial cap", () => {
  const pool = Array.from({ length: 30 }, (_, i) =>
    row(`Restaurant ${i}`, "restaurants", 70 + i)
  );
  assert.equal(foodDrinkGuidePlaceCount(pool), 30);
  const sections = organizeFoodDrinkGuide(pool);
  const primaryTotal = sections
    .filter((s) => s.id !== "editors_picks" && s.id !== "hidden_gems" && s.id !== "dog_friendly")
    .reduce((sum, s) => sum + s.cards.length, 0);
  assert.equal(primaryTotal, 30);
});

test("guide organizes places into editorial category sections", () => {
  const pool = [
    row("Joe Coffee", "coffee", 90),
    row("Rise Bakery", "bakeries", 88),
    row("Tony Pizza", "restaurants", 86),
  ];
  const sections = organizeFoodDrinkGuide(pool);
  const ids = new Set(sections.map((s) => s.id));
  assert.ok(ids.has("coffee"));
  assert.ok(ids.has("bakery"));
  assert.ok(ids.has("pizza"));
});
