import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMetroEventsPoolPayload,
  parseMetroEventsPool,
} from "./metroPoolPayload.ts";
import { KINDRED_METRO_CACHE_VERSION } from "./metroCacheVersion.ts";
import { compareByLocalProximity } from "./localDiscoveryScope.ts";
import type { RankedDiscoveryItem } from "./discovery.ts";

test("parseMetroEventsPool rejects wrong poolVersion", () => {
  const payload = {
    poolVersion: KINDRED_METRO_CACHE_VERSION - 1,
    eventsPool: [{ name: "A" }],
  };
  assert.equal(parseMetroEventsPool(payload), null);
});

test("parseMetroEventsPool accepts current poolVersion", () => {
  const payload = buildMetroEventsPoolPayload({
    eventsPool: [{ name: "Summer Fest" }],
  });
  const parsed = parseMetroEventsPool(payload);
  assert.ok(parsed);
  assert.equal(parsed!.eventsPool.length, 1);
});

test("reader coordinates change ranking without mutating candidate pool", () => {
  const pool: RankedDiscoveryItem[] = [
    {
      item: {
        id: "gilbert",
        title: "Gilbert Spot",
        dek: "",
        category: "restaurants",
        family: "food_drink",
        source: { name: "Kindred", tier: "local" },
        tags: [],
        lat: 33.35,
        lon: -111.79,
      },
      score: 80,
      reasons: [],
      surfaces: ["restaurants"],
    },
    {
      item: {
        id: "glendale",
        title: "Glendale Spot",
        dek: "",
        category: "restaurants",
        family: "food_drink",
        source: { name: "Kindred", tier: "local" },
        tags: [],
        lat: 33.54,
        lon: -112.19,
      },
      score: 80,
      reasons: [],
      surfaces: ["restaurants"],
    },
  ];

  const gilbertReader = { lat: 33.3528, lon: -111.789, city: "Gilbert" };
  const glendaleReader = { lat: 33.5387, lon: -112.186, city: "Glendale" };

  const gilbertOrder = [...pool].sort((a, b) =>
    compareByLocalProximity(a, b, gilbertReader)
  );
  const glendaleOrder = [...pool].sort((a, b) =>
    compareByLocalProximity(a, b, glendaleReader)
  );

  assert.equal(gilbertOrder[0]?.item.id, "gilbert");
  assert.equal(glendaleOrder[0]?.item.id, "glendale");
  assert.equal(pool[0]?.item.id, "gilbert");
  assert.equal(pool[1]?.item.id, "glendale");
});
