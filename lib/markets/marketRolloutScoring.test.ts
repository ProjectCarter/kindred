import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  displayNameForMarket,
  nationalSignificanceScore,
  populationTierFromSeed,
} from "./marketRolloutScoring.ts";

describe("marketRolloutScoring", () => {
  it("assigns tier_1 to top 10 metros", () => {
    assert.equal(
      populationTierFromSeed({ market_type: "major_metro", population_rank: 5 }),
      "tier_1_national"
    );
  });

  it("boosts state capitals in national significance", () => {
    const phoenix = nationalSignificanceScore({
      primary_city: "Phoenix",
      state_code: "AZ",
      population_rank: 11,
      market_type: "major_metro",
      tourism_priority: 0,
    });
    const gilbertProxy = nationalSignificanceScore({
      primary_city: "Gilbert",
      state_code: "AZ",
      population_rank: 80,
      market_type: "major_metro",
      tourism_priority: 0,
    });
    assert.ok(phoenix > gilbertProxy);
  });

  it("uses primary city as display name for major metros", () => {
    assert.equal(
      displayNameForMarket({
        market_name: "Seattle Metro",
        primary_city: "Seattle",
        market_type: "major_metro",
      }),
      "Seattle"
    );
  });
});
