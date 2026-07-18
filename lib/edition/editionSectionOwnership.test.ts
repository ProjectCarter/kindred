import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyEventListingSection,
  filterEventsForLocalEventsDesk,
  isFoodDrinksSectionType,
  isGenuineTicketedFoodEvent,
  isMalformedEventListing,
  normalizeEditionSectionType,
} from "./editionSectionOwnership.ts";

test("restaurant record routes to food_drinks only", () => {
  assert.equal(
    classifyEventListingSection({
      name: "Postino WineCafe Gilbert",
      venue: "Postino WineCafe",
      category: "food",
      sourceUrl: "https://example.com/postino",
    }),
    "food_drinks"
  );
});

test("genuine ticketed food festival stays in local_events", () => {
  const festival = {
    name: "Gilbert Food Festival 2026",
    venue: "Downtown Gilbert",
    sourceUrl: "https://example.com/food-fest",
  };
  assert.equal(isGenuineTicketedFoodEvent(festival), true);
  assert.equal(classifyEventListingSection(festival), "local_events");
});

test("drag and adult nightlife listings are excluded", () => {
  for (const name of [
    "Drag Show Saturday Night",
    "Burlesque Drag Brunch",
    "Adult Nightclub VIP",
  ]) {
    assert.equal(
      classifyEventListingSection({
        name,
        venue: "Club Neon",
        sourceUrl: "https://example.com/event",
      }),
      "exclude"
    );
  }
});

test("malformed placeholder listings are excluded", () => {
  assert.equal(
    isMalformedEventListing({
      name: "Contact Us",
      venue: "Venue TBA",
      sourceUrl: "https://example.com/contact",
    }),
    true
  );
  assert.equal(
    classifyEventListingSection({
      name: "Events Calendar",
      venue: "Gilbert",
      sourceUrl: "https://example.com/events-calendar",
    }),
    "exclude"
  );
});

test("filterEventsForLocalEventsDesk dedupes and splits desks", () => {
  const result = filterEventsForLocalEventsDesk([
    {
      name: "Phoenix Suns vs Lakers",
      venue: "Footprint Center",
      sourceUrl: "https://example.com/suns",
    },
    {
      name: "Joe's Coffee Shop Live Music",
      venue: "Joe's Coffee",
      sourceUrl: "https://example.com/joes",
      category: "food",
    },
    {
      name: "Phoenix Suns vs Lakers",
      venue: "Footprint Center",
      sourceUrl: "https://example.com/suns",
    },
  ]);

  assert.equal(result.kept.length, 1);
  assert.equal(result.kept[0]?.name, "Phoenix Suns vs Lakers");
  assert.equal(result.reroutedFood.length, 1);
  assert.equal(result.excluded.length, 1);
});

test("legacy recommendations section maps to food_drinks", () => {
  assert.equal(normalizeEditionSectionType("recommendations"), "food_drinks");
  assert.equal(isFoodDrinksSectionType("recommendations"), true);
  assert.equal(isFoodDrinksSectionType("food_drinks"), true);
});
