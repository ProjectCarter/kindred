import test from "node:test";
import assert from "node:assert/strict";
import { isFoodDrinksEnabled, ENABLE_FOOD_DRINKS } from "./editionSectionFlags.ts";
import { resolveFoodDrinksHomepageItems } from "./foodDrinksSection.ts";
import type { EditionSection } from "./types.ts";

test("ENABLE_FOOD_DRINKS is enabled after cost testing", () => {
  assert.equal(ENABLE_FOOD_DRINKS, true);
  assert.equal(isFoodDrinksEnabled(), true);
});

test("resolveFoodDrinksHomepageItems returns items when enabled and section present", () => {
  const sections: EditionSection[] = [
    {
      edition_id: "ed-1",
      section_type: "food_drinks",
      position: 6,
      headline: "Food & Drink",
      body: JSON.stringify({
        version: 1,
        items: [{ id: "place-1", title: "Test Cafe", category: "coffee", score: 90 }],
      }),
      source_note: null,
    },
  ];
  const items = resolveFoodDrinksHomepageItems({
    sections,
    discovery: null,
  });
  assert.equal(items.length, 1);
});
