import assert from "node:assert/strict";
import test from "node:test";
import type { RankedDiscoveryItem } from "../edition/discovery.ts";
import { analyzeEditionDeskAvailability } from "./editionDeskAvailability.ts";
import {
  composeWeatherPlanningNote,
  resolveWeatherPlanningNote,
} from "./weatherPlanningNote.ts";
import { parseWeatherSummaryText } from "./parseWeatherSummary.ts";

function activityRow(category: string, subtypeHay: string): RankedDiscoveryItem {
  return {
    score: 10,
    surfaces: [],
    reasons: [],
    item: {
      id: subtypeHay,
      title: subtypeHay,
      dek: subtypeHay,
      category: "activities",
      family: "activities",
      tags: ["local_place", "verified"],
      venueCategories: [subtypeHay],
      source: { name: "Foursquare", tier: "local", url: null },
    },
  } as RankedDiscoveryItem;
}

function foodRow(category: "coffee" | "restaurants"): RankedDiscoveryItem {
  return {
    score: 10,
    surfaces: [],
    reasons: [],
    item: {
      id: category,
      title: "Joe Coffee",
      dek: "Coffee shop",
      category,
      family: "food_drink",
      tags: ["local_place", "verified"],
      venueCategories: ["Coffee Shop"],
      source: { name: "Foursquare", tier: "local", url: null },
    },
  } as RankedDiscoveryItem;
}

test("analyzeEditionDeskAvailability detects coffee, indoor, and events", () => {
  const desks = analyzeEditionDeskAvailability({
    activities: [activityRow("activities", "Rock Climbing Gym")],
    foodDrinks: [foodRow("coffee")],
    localEventsCount: 3,
  });

  assert.equal(desks.coffeeShops, true);
  assert.equal(desks.indoorActivities, true);
  assert.equal(desks.localEvents, true);
});

test("composeWeatherPlanningNote uses verified hot-day copy tied to edition desks", () => {
  const parsed = parseWeatherSummaryText(
    "Current 88°F in Gilbert; high 103°F / low 82°F; overcast skies."
  );
  const note = composeWeatherPlanningNote({
    parsed,
    condition: { emoji: "☁️", label: "Cloudy" },
    rawSummary:
      "Current 88°F in Gilbert; high 103°F / low 82°F; overcast skies.",
    editionDesks: analyzeEditionDeskAvailability({
      activities: [activityRow("activities", "Rock Climbing Gym")],
      foodDrinks: [foodRow("coffee")],
      localEventsCount: 2,
    }),
  });

  assert.ok(note);
  assert.match(note!, /103°/);
  assert.match(note!, /overcast skies/i);
  assert.match(note!, /coffee shops/i);
  assert.match(note!, /indoor activities/i);
  assert.doesNotMatch(note!, /rain/i);
});

test("composeWeatherPlanningNote recommends hiking only when hiking exists", () => {
  const note = composeWeatherPlanningNote({
    parsed: parseWeatherSummaryText(
      "Current 58°F in Gilbert; high 78°F / low 55°F; clear skies."
    ),
    condition: { emoji: "☀️", label: "Clear skies" },
    rawSummary:
      "Current 58°F in Gilbert; high 78°F / low 55°F; clear skies.",
    editionDesks: analyzeEditionDeskAvailability({
      activities: [
        {
          ...activityRow("hiking", "Desert Trail"),
          item: {
            ...activityRow("hiking", "Desert Trail").item,
            category: "hiking",
          },
        },
      ],
      foodDrinks: [],
      localEventsCount: 0,
    }),
  });

  assert.ok(note);
  assert.match(note!, /58°|Cool morning/i);
  assert.match(note!, /hiking/i);
});

test("resolveWeatherPlanningNote omits invented storm language", () => {
  const note = resolveWeatherPlanningNote({
    weatherSectionBody:
      "Current 88°F in Gilbert; high 103°F / low 82°F; overcast skies.",
    condition: { emoji: "☁️", label: "Cloudy" },
    editionDesks: analyzeEditionDeskAvailability({
      activities: [activityRow("activities", "Bowling Alley")],
      foodDrinks: [foodRow("restaurants")],
      localEventsCount: 1,
    }),
  });

  assert.ok(note);
  assert.doesNotMatch(note!, /storm/i);
});
