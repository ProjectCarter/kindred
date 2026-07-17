import test from "node:test";
import assert from "node:assert/strict";
import {
  GENERAL_PLACE_FALLBACK,
  resolveVerifiedEditorialCategory,
} from "./editorialCategory.ts";

test("activities discovery category resolves without crashing (general_place fallback)", () => {
  const result = resolveVerifiedEditorialCategory({
    title: "Sunset Social Club",
    dek: "A weekly community hangout with live DJs.",
    venueCategories: [],
    discoveryCategory: "activities",
  });

  assert.equal(result.categoryId, "general_place");
  assert.equal(result.displayLabel, "local activity");
  assert.equal(result.imageTag, "general_activity");
  assert.equal(result.confidence, "tentative");
  assert.deepEqual(result.sources, []);
});

test("unknown discovery category uses deterministic general_place fallback", () => {
  const result = resolveVerifiedEditorialCategory({
    title: "Mystery Venue",
    discoveryCategory: "experiences",
  });

  assert.equal(result.categoryId, GENERAL_PLACE_FALLBACK.categoryId);
  assert.equal(result.displayLabel, GENERAL_PLACE_FALLBACK.displayLabel);
  assert.equal(result.imageTag, GENERAL_PLACE_FALLBACK.imageTag);
  assert.equal(result.confidence, "tentative");
});

test("null and undefined metadata resolve safely", () => {
  const result = resolveVerifiedEditorialCategory({
    title: null,
    dek: undefined,
    venueCategories: null,
    discoveryCategory: null,
  });

  assert.equal(result.categoryId, "general_place");
  assert.equal(result.imageTag, "general_activity");
  assert.ok(result.displayLabel.length > 0);
});

test("coffee discovery category still resolves to coffee shop profile", () => {
  const result = resolveVerifiedEditorialCategory({
    title: "Joe's Coffee",
    dek: "Neighborhood espresso bar.",
    discoveryCategory: "coffee",
  });

  assert.equal(result.categoryId, "coffee_shop");
  assert.equal(result.displayLabel, "coffee shop");
  assert.equal(result.imageTag, "coffee_shop");
});

test("verified brewery name match is unchanged", () => {
  const result = resolveVerifiedEditorialCategory({
    title: "Desert Eagle Brewing",
    dek: "Craft beer and a patio.",
    venueCategories: ["Brewery"],
    discoveryCategory: "restaurants",
  });

  assert.equal(result.categoryId, "brewery");
  assert.equal(result.imageTag, "brewery");
  assert.notEqual(result.confidence, "tentative");
});

test("every DISCOVERY_FALLBACK desk resolves with a valid imageTag", () => {
  const desks = [
    "coffee",
    "restaurants",
    "bakeries",
    "parks",
    "gardens",
    "museums",
    "beaches",
    "hiking",
    "scenic_drives",
    "activities",
  ] as const;

  for (const discoveryCategory of desks) {
    const result = resolveVerifiedEditorialCategory({
      title: "Neutral Community Venue",
      dek: "A local spot worth knowing about.",
      discoveryCategory,
    });
    assert.ok(result.imageTag, `missing imageTag for ${discoveryCategory}`);
    assert.ok(result.categoryId);
    assert.ok(result.displayLabel);
  }
});
