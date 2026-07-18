import {
  US_METRO_TOP_100,
  US_TOURIST_DESTINATIONS,
} from "./data/usMarketDirectoryData.ts";
import { metroKeyFromPlace } from "../location/metroKey.ts";
import {
  rankUsMarketSeeds,
  usMarketSlugFromParts,
} from "./ranking.ts";
import type { UsMarketSeedInput } from "./types.ts";
import {
  displayNameForMarket,
  nationalSignificanceScore,
  populationTierFromSeed,
  regionalCoverageScore,
} from "./marketRolloutScoring.ts";

function finalizeSeed(seed: UsMarketSeedInput): UsMarketSeedInput {
  const regional_priority = regionalCoverageScore(seed);
  const national_significance_score = nationalSignificanceScore(seed);
  return {
    ...seed,
    display_name: displayNameForMarket(seed),
    population_tier: populationTierFromSeed(seed),
    regional_priority,
    national_significance_score,
  };
}

function metroRowsToSeeds(): UsMarketSeedInput[] {
  return US_METRO_TOP_100.slice(0, 100).map((row, index) => {
    const [
      primary_city,
      state_code,
      state_name,
      population,
      latitude,
      longitude,
      timezone,
      ...metro_cities
    ] = row;
    const market_type = "major_metro" as const;
    const slug = usMarketSlugFromParts({ primary_city, state_code, market_type });
    const seed: UsMarketSeedInput = finalizeSeed({
      slug,
      metro_key: metroKeyFromPlace({ city: primary_city, state: state_code }),
      display_name: primary_city,
      market_name: `${primary_city} Metro`,
      primary_city,
      state_name,
      state_code,
      market_type,
      population,
      population_rank: index + 1,
      latitude,
      longitude,
      timezone,
      metro_cities: [primary_city, ...metro_cities],
    });
    return seed;
  });
}

function touristRowsToSeeds(): UsMarketSeedInput[] {
  return US_TOURIST_DESTINATIONS.map((row) => {
    const [
      primary_city,
      state_code,
      state_name,
      latitude,
      longitude,
      timezone,
      tourism_priority,
      tourism_rank,
    ] = row;
    const market_type = "tourist_destination" as const;
    const slug = usMarketSlugFromParts({ primary_city, state_code, market_type });
    return finalizeSeed({
      slug,
      metro_key: metroKeyFromPlace({ city: primary_city, state: state_code }),
      display_name: primary_city,
      market_name: primary_city,
      primary_city,
      state_name,
      state_code,
      market_type,
      population: null,
      population_rank: null,
      tourism_rank,
      tourism_priority,
      regional_priority: 0,
      latitude,
      longitude,
      timezone,
      metro_cities: [primary_city],
    });
  });
}

/** Full ranked United States market directory seed (metros + tourist destinations). */
export function buildUsMarketDirectorySeeds() {
  const merged = [...metroRowsToSeeds(), ...touristRowsToSeeds()];

  // Deduplicate by slug — keep first (metro wins over duplicate tourist row e.g. Savannah).
  const seen = new Set<string>();
  const unique: UsMarketSeedInput[] = [];
  for (const seed of merged) {
    if (seen.has(seed.slug)) continue;
    seen.add(seed.slug);
    unique.push(seed);
  }

  return rankUsMarketSeeds(unique);
}

export function countUsMarketSeeds() {
  const ranked = buildUsMarketDirectorySeeds();
  return {
    total: ranked.length,
    majorMetro: ranked.filter((m) => m.market_type === "major_metro").length,
    touristDestination: ranked.filter(
      (m) => m.market_type === "tourist_destination"
    ).length,
  };
}
