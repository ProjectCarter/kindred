import assert from "node:assert/strict";
import test from "node:test";
import type { DiscoveryItem } from "./discovery.ts";
import {
  composeFoodDrinkEditorialNote,
  foodDrinkEditorialNote,
  foodDrinkLocationLine,
  isAddressStyleFoodCopy,
} from "./foodDrinkPresentation.ts";

function foodItem(overrides: Partial<DiscoveryItem> = {}): DiscoveryItem {
  return {
    id: "place_test",
    title: "Cornish Pasty Co.",
    dek: "1941 W Guadalupe Rd (at S Dobson Rd), Mesa, AZ 85202 — Mesa",
    category: "restaurants",
    family: "food_drink",
    source: { name: "Foursquare", tier: "local", url: null },
    tags: ["local_place", "verified"],
    venueCategories: ["English Restaurant", "Gastropub", "Pub"],
    address: "1941 W Guadalupe Rd (at S Dobson Rd), Mesa, AZ 85202",
    place: { city: "Mesa", state: "AZ" },
    ...overrides,
  };
}

test("isAddressStyleFoodCopy detects map-export deks", () => {
  assert.equal(
    isAddressStyleFoodCopy("1941 W Guadalupe Rd, Mesa, AZ 85202 — Mesa"),
    true
  );
  assert.equal(
    isAddressStyleFoodCopy("Mesa spot for handheld pies and pub-style fare."),
    false
  );
});

test("foodDrinkEditorialNote replaces address-style dek with verified editorial copy", () => {
  const note = foodDrinkEditorialNote(foodItem(), "Gilbert");
  assert.ok(note);
  assert.equal(isAddressStyleFoodCopy(note), false);
  assert.match(note!, /handheld pies|pub-style fare/i);
  assert.match(note!, /Mesa/i);
});

test("foodDrinkEditorialNote keeps usable existing editorial dek", () => {
  const note = foodDrinkEditorialNote(
    foodItem({
      dek: "Mesa institution for Cornish pasties — order at the counter and eat in the pub room.",
    })
  );
  assert.equal(
    note,
    "Mesa institution for Cornish pasties — order at the counter and eat in the pub room."
  );
});

test("chain items get honest understated notes", () => {
  const note = foodDrinkEditorialNote(
    foodItem({
      title: "MOD Pizza",
      dek: "2020 E Elliot Rd, Tempe, AZ 85284 — Tempe",
      venueCategories: ["Pizzeria"],
      tags: ["local_place", "verified"],
      place: { city: "Tempe", state: "AZ" },
    })
  );
  assert.match(note!, /reliable/i);
  assert.match(note!, /familiar/i);
  assert.doesNotMatch(note!, /short list/i);
  assert.equal(isAddressStyleFoodCopy(note), false);
});

test("foodDrinkLocationLine prefers city over street address", () => {
  assert.equal(foodDrinkLocationLine(foodItem()), "Mesa, AZ");
});

test("composeFoodDrinkEditorialNote uses editorial labels when present", () => {
  const note = composeFoodDrinkEditorialNote(
    foodItem({
      dek: "",
      venueEditorial: {
        score: 88,
        labels: ["local_favorite"],
        kindredVenueId: "cornish",
      },
    })
  );
  assert.match(note, /local favorite/i);
});
