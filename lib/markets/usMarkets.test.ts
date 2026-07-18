import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeMarketRankingScore,
  rankUsMarketSeeds,
  usMarketSlugFromParts,
} from "./ranking.ts";
import { buildUsMarketDirectorySeeds, countUsMarketSeeds } from "./usMarketDirectory.ts";
import {
  assertUsCountryCode,
  assertUsKindredPlace,
  isUsKindredPlace,
  NonUsMarketError,
} from "./usOnly.ts";
import { MARKET_BATCH_ACTIONS_ENABLED } from "./constants.ts";

describe("US market ranking", () => {
  it("is deterministic for the same inputs", () => {
    const a = computeMarketRankingScore({
      population_rank: 10,
      tourism_rank: null,
      tourism_priority: 0,
      regional_priority: 0,
      national_significance_score: 20,
      future_user_demand_score: 0,
    });
    const b = computeMarketRankingScore({
      population_rank: 10,
      tourism_rank: null,
      tourism_priority: 0,
      regional_priority: 0,
      national_significance_score: 20,
      future_user_demand_score: 0,
    });
    assert.equal(a, b);
  });

  it("ranks larger metros ahead of small tourist towns without population", () => {
    const ranked = rankUsMarketSeeds([
      {
        slug: "sedona-az-destination",
        metro_key: "sedona-az",
        market_name: "Sedona",
        primary_city: "Sedona",
        state_name: "Arizona",
        state_code: "AZ",
        market_type: "tourist_destination",
        population: null,
        population_rank: null,
        tourism_priority: 90,
        tourism_rank: 1,
        latitude: 34.87,
        longitude: -111.76,
        timezone: "America/Phoenix",
      },
      {
        slug: "phoenix-az-metro",
        metro_key: "phoenix-az",
        market_name: "Phoenix Metro",
        primary_city: "Phoenix",
        state_name: "Arizona",
        state_code: "AZ",
        market_type: "major_metro",
        population: 4_900_000,
        population_rank: 11,
        latitude: 33.45,
        longitude: -112.07,
        timezone: "America/Phoenix",
        metro_cities: ["Phoenix", "Gilbert"],
      },
    ]);
    assert.equal(ranked[0]?.primary_city, "Phoenix");
    assert.equal(ranked[0]?.overall_rank, 1);
  });

  it("seeds 100 major metros and tourist destinations", () => {
    const counts = countUsMarketSeeds();
    assert.equal(counts.majorMetro, 100);
    assert.ok(counts.touristDestination >= 12);
    assert.ok(counts.total >= 112);
  });
});

describe("US-only enforcement", () => {
  it("accepts US places with state codes", () => {
    assert.equal(
      isUsKindredPlace({
        city: "San Diego",
        state: "CA",
        region: "California",
        lat: 32.7,
        lon: -117.1,
      }),
      true
    );
  });

  it("rejects international places", () => {
    assert.throws(
      () =>
        assertUsKindredPlace({
          city: "London",
          state: null,
          region: "England",
          lat: 51.5,
          lon: -0.12,
        }),
      NonUsMarketError
    );
  });

  it("rejects non-US country codes", () => {
    assert.throws(() => assertUsCountryCode("GB"), NonUsMarketError);
  });
});

describe("batch controls", () => {
  it("remain disabled during rollout infrastructure", () => {
    assert.equal(MARKET_BATCH_ACTIONS_ENABLED, false);
  });
});

describe("duplicate slug prevention", () => {
  it("assigns unique slugs across market types", () => {
    const metro = usMarketSlugFromParts({
      primary_city: "Aspen",
      state_code: "CO",
      market_type: "major_metro",
    });
    const tourist = usMarketSlugFromParts({
      primary_city: "Aspen",
      state_code: "CO",
      market_type: "tourist_destination",
    });
    assert.notEqual(metro, tourist);
  });
});

describe("directory stability", () => {
  it("produces stable overall ranks across runs", () => {
    const first = buildUsMarketDirectorySeeds().map((m) => m.slug);
    const second = buildUsMarketDirectorySeeds().map((m) => m.slug);
    assert.deepEqual(first, second);
  });

  it("includes Gilbert in Phoenix metro membership", () => {
    const phoenix = buildUsMarketDirectorySeeds().find(
      (m) => m.slug === "phoenix-az-metro"
    );
    assert.ok(phoenix?.metro_cities?.includes("Gilbert"));
  });
});
