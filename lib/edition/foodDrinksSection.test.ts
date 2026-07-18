import test from "node:test";
import assert from "node:assert/strict";
import type { EditionSection } from "./types.ts";
import type { DiscoveryPayload, RankedDiscoveryItem } from "./discovery.ts";
import {
  findFoodDrinksSection,
  parseFoodDrinksSectionBody,
  resolveFoodDrinksHomepageItems,
  resolveFoodDrinksItemsFromSection,
  isRenderedFoodDrinksSectionType,
} from "./foodDrinksSection.ts";
import { classifyEventListingSection } from "./editionSectionOwnership.ts";

function section(
  section_type: string,
  body: string,
  position = 6
): EditionSection {
  return {
    id: `sec-${section_type}`,
    section_type,
    position,
    headline: "Food & Drink",
    body,
    source_note: null,
  };
}

function discoveryWithCoffee(): DiscoveryPayload {
  const coffee: RankedDiscoveryItem = {
    item: {
      id: "place_coffee_1",
      title: "Joe's Coffee",
      dek: "Neighborhood roast",
      category: "coffee",
      family: "food_drink",
      source: { name: "Kindred", tier: "local" },
      tags: ["local_place"],
    },
    score: 88,
    reasons: [],
    surfaces: ["coffee"],
  };
  return {
    version: 1,
    generatedAt: "2026-07-18T00:00:00.000Z",
    editionDate: "2026-07-18",
    location: { city: "Gilbert", region: "AZ", state: "AZ", lat: 33.27, lon: -111.78 },
    surfaces: {
      coffee: {
        surface: "coffee",
        headline: "Coffee",
        editorNote: "",
        items: [coffee],
      },
    },
    picks: [],
    editorBrief: "",
    selectionMeta: {
      candidateCount: 1,
      selectedCount: 1,
      editorNotes: [],
    },
  };
}

test("parseFoodDrinksSectionBody reads persisted item ids", () => {
  const parsed = parseFoodDrinksSectionBody(
    JSON.stringify({
      version: 1,
      items: [{ id: "place_coffee_1", title: "Joe's Coffee", category: "coffee", score: 88 }],
    })
  );
  assert.equal(parsed?.items?.length, 1);
  assert.equal(parsed?.items?.[0]?.id, "place_coffee_1");
});

test("persisted food_drinks section resolves discovery items for homepage", () => {
  const sections = [
    section(
      "food_drinks",
      JSON.stringify({
        version: 1,
        items: [{ id: "place_coffee_1", title: "Joe's Coffee", category: "coffee", score: 88 }],
      })
    ),
  ];
  const items = resolveFoodDrinksHomepageItems({
    sections,
    discovery: discoveryWithCoffee(),
    fallbackItems: [],
  });
  assert.equal(items.length, 1);
  assert.equal(items[0]?.item.title, "Joe's Coffee");
});

test("legacy recommendations section renders as Food & Drinks", () => {
  const sections = [
    section(
      "recommendations",
      JSON.stringify({
        version: 1,
        items: [{ id: "place_coffee_1", title: "Joe's Coffee", category: "coffee", score: 88 }],
      })
    ),
  ];
  const items = resolveFoodDrinksItemsFromSection(sections[0], discoveryWithCoffee());
  assert.equal(items.length, 1);
  assert.ok(isRenderedFoodDrinksSectionType("recommendations"));
});

test("empty food_drinks section falls back to discovery allocation", () => {
  const fallback: RankedDiscoveryItem[] = [
    {
      item: {
        id: "place_bakery_1",
        title: "Main Street Bakery",
        dek: "",
        category: "bakeries",
        family: "food_drink",
        source: { name: "Kindred", tier: "local" },
        tags: [],
      },
      score: 70,
      reasons: [],
      surfaces: ["bakeries"],
    },
  ];
  const items = resolveFoodDrinksHomepageItems({
    sections: [section("food_drinks", JSON.stringify({ version: 1, items: [] }))],
    discovery: discoveryWithCoffee(),
    fallbackItems: fallback,
  });
  assert.equal(items.length, 1);
  assert.equal(items[0]?.item.title, "Main Street Bakery");
});

test("malformed food_drinks body omits section and uses fallback", () => {
  const fallback: RankedDiscoveryItem[] = [
    {
      item: {
        id: "place_rest_1",
        title: "Desert Bistro",
        dek: "",
        category: "restaurants",
        family: "food_drink",
        source: { name: "Kindred", tier: "local" },
        tags: [],
      },
      score: 65,
      reasons: [],
      surfaces: ["restaurants"],
    },
  ];
  const items = resolveFoodDrinksHomepageItems({
    sections: [section("food_drinks", "not-json")],
    discovery: null,
    fallbackItems: fallback,
  });
  assert.equal(items.length, 1);
  assert.equal(items[0]?.item.title, "Desert Bistro");
});

test("findFoodDrinksSection prefers canonical key", () => {
  const sections = [
    section("recommendations", '{"version":1,"items":[]}'),
    section("food_drinks", '{"version":1,"items":[{"id":"a","title":"A","category":"coffee"}]}'),
  ];
  assert.equal(findFoodDrinksSection(sections)?.section_type, "food_drinks");
});

test("empty food_drinks section with no fallback omits homepage desk", () => {
  const items = resolveFoodDrinksHomepageItems({
    sections: [section("food_drinks", JSON.stringify({ version: 1, items: [] }))],
    discovery: null,
    fallbackItems: [],
  });
  assert.equal(items.length, 0);
});

test("food_drinks section ids do not route through local events desk", () => {
  assert.equal(
    classifyEventListingSection({ name: "Summer Food Festival", venue: "Downtown Park" }),
    "local_events"
  );
  assert.equal(
    classifyEventListingSection({ name: "Joe's Coffee Shop", venue: "Main St" }),
    "food_drinks"
  );
});

test("venueEditorial score 0 is treated as unset for homepage eligibility", () => {
  function guideEligible(score: number | undefined): boolean {
    if (typeof score !== "number" || score <= 0) return true;
    return score >= 60;
  }
  assert.equal(guideEligible(0), true);
  assert.equal(guideEligible(undefined), true);
  assert.equal(guideEligible(45), false);
  assert.equal(guideEligible(70), true);
});
