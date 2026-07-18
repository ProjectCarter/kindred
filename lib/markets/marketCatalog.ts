import {
  displayNameForMarket,
  nationalSignificanceScore,
  populationTierFromSeed,
  regionalCoverageScore,
} from "./marketRolloutScoring.ts";
import type { UsMarketCatalogEntry, UsMarketSeedInput } from "./types.ts";
import { buildUsMarketDirectorySeeds } from "./usMarketDirectory.ts";
import {
  KINDRED_MARKET_DEFAULT_RADIUS_MILES,
} from "./constants.ts";

/** Production catalog — ranked Top 100 U.S. metros + tourist destinations. No API calls. */
export function buildUsMarketCatalog(): UsMarketCatalogEntry[] {
  return buildUsMarketDirectorySeeds().map((seed) => toCatalogEntry(seed));
}

export function toCatalogEntry(seed: UsMarketSeedInput & { overall_rank: number; rollout_priority?: number }): UsMarketCatalogEntry {
  return {
    metro_key: seed.metro_key,
    display_name: seed.display_name,
    state: seed.state_code,
    latitude: seed.latitude,
    longitude: seed.longitude,
    search_radius_miles: KINDRED_MARKET_DEFAULT_RADIUS_MILES,
    timezone: seed.timezone,
    population_tier: seed.population_tier ?? populationTierFromSeed(seed),
    tourism_priority: seed.tourism_priority ?? 0,
    rollout_priority: seed.rollout_priority ?? seed.overall_rank,
    status: "planned",
    slug: seed.slug,
    market_type: seed.market_type,
    overall_rank: seed.overall_rank,
  };
}

export function topUsMarkets(limit = 100): UsMarketCatalogEntry[] {
  return buildUsMarketCatalog()
    .filter((m) => m.market_type === "major_metro")
    .slice(0, limit);
}

export function enrichSeedScores(seed: UsMarketSeedInput): UsMarketSeedInput {
  const regional_priority = regionalCoverageScore(seed);
  const national_significance_score = nationalSignificanceScore(seed);
  const population_tier = populationTierFromSeed(seed);
  const display_name = seed.display_name || displayNameForMarket(seed);
  return {
    ...seed,
    display_name,
    regional_priority,
    national_significance_score,
    population_tier,
  };
}
