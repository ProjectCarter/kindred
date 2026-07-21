import test from "node:test";
import assert from "node:assert/strict";
import {
  DISCOVERY_ACTIVITY_RADIUS_MILES,
  DISCOVERY_FOOD_RADIUS_MILES,
  DISCOVERY_HISTORICAL_PLACES_RADIUS_MILES,
  catalogMetroKeyForReaderLocation,
  resolveDiscoveryGeographySnapshot,
} from "./discoveryGeography.ts";
import {
  discoveryRadiusKmForCategory,
  isWithinActivitiesSectionRadius,
  isWithinFoodDiscoveryRadius,
  isWithinLocalDiscoveryRadius,
} from "./localDiscoveryScope.ts";
import type { RankedDiscoveryItem } from "./discovery.ts";

const GILBERT = { lat: 33.3528, lon: -111.789 };

function ranked(
  partial: Partial<RankedDiscoveryItem["item"]> & {
    title: string;
    category: RankedDiscoveryItem["item"]["category"];
  }
): RankedDiscoveryItem {
  return {
    item: {
      id: partial.id ?? "test",
      title: partial.title,
      dek: "",
      category: partial.category,
      family: "outdoors",
      source: { name: "Foursquare", tier: "local" },
      tags: partial.tags ?? ["local_place", "verified"],
      seasons: ["anytime"],
      weatherFit: ["any"],
      popularity: 0.5,
      uniqueness: 0.5,
      localExpertise: 0.8,
      quality: 0.8,
      lat: partial.lat ?? null,
      lon: partial.lon ?? null,
    },
    score: 80,
    surfaces: [],
    reasons: [],
  };
}

test("discovery geography snapshot for Gilbert reader", () => {
  const snapshot = resolveDiscoveryGeographySnapshot({
    city: "Gilbert",
    market: {
      metroKey: "phoenix-az",
      slug: "phoenix-az-metro",
      marketName: "Phoenix Metro",
      primaryCity: "Phoenix",
      metroCities: ["Gilbert", "Mesa", "Tempe"],
      stateCode: "AZ",
      latitude: 33.4484,
      longitude: -112.074,
      defaultRadiusMiles: 25,
      fallbackRadiusMiles: 50,
    },
  });
  assert.equal(snapshot.userCity, "Gilbert");
  assert.equal(snapshot.resolvedMetro, "phoenix-az");
  assert.equal(snapshot.eventsScope, "Phoenix Metro");
  assert.equal(snapshot.activitiesRadiusMiles, DISCOVERY_ACTIVITY_RADIUS_MILES);
  assert.equal(snapshot.foodRadiusMiles, DISCOVERY_FOOD_RADIUS_MILES);
  assert.equal(
    snapshot.historicalPlacesRadiusMiles,
    DISCOVERY_HISTORICAL_PLACES_RADIUS_MILES
  );
});

test("Gilbert reader resolves phoenix-az catalog metro key", () => {
  assert.equal(
    catalogMetroKeyForReaderLocation({
      city: "Gilbert",
      state: "AZ",
      lat: 33.3528,
      lon: -111.789,
    }),
    "phoenix-az"
  );
});

test("food uses 15-mile radius from reader", () => {
  assert.equal(discoveryRadiusKmForCategory("coffee"), DISCOVERY_FOOD_RADIUS_MILES * 1.609344);
  const nearby = ranked({
    title: "Neighborhood Coffee",
    category: "coffee",
    lat: 33.36,
    lon: -111.79,
  });
  const far = ranked({
    title: "West Valley Coffee",
    category: "coffee",
    lat: 33.54,
    lon: -112.19,
  });
  assert.equal(isWithinFoodDiscoveryRadius(nearby, GILBERT), true);
  assert.equal(isWithinFoodDiscoveryRadius(far, GILBERT), false);
  assert.equal(isWithinLocalDiscoveryRadius(far, GILBERT), false);
});

test("activities keep 25-mile radius from reader", () => {
  const within = ranked({
    title: "Tempe Escape Room",
    category: "activities",
    lat: 33.4255,
    lon: -111.94,
  });
  const far = ranked({
    title: "Far Escape Room",
    category: "activities",
    lat: 34.5,
    lon: -111.0,
  });
  assert.equal(isWithinActivitiesSectionRadius(within, GILBERT), true);
  assert.equal(isWithinActivitiesSectionRadius(far, GILBERT), false);
});
