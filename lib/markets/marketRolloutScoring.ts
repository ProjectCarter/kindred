import type { UsMarketSeedInput } from "./types.ts";

/** Population tiers for rollout planning — derived from population rank. */
export type PopulationTier =
  | "tier_1_national"
  | "tier_2_major"
  | "tier_3_regional"
  | "tier_4_emerging"
  | "tourist_destination";

const STATE_CAPITALS = new Set(
  [
    "Montgomery,AL",
    "Juneau,AK",
    "Phoenix,AZ",
    "Little Rock,AR",
    "Sacramento,CA",
    "Denver,CO",
    "Hartford,CT",
    "Dover,DE",
    "Washington,DC",
    "Tallahassee,FL",
    "Atlanta,GA",
    "Honolulu,HI",
    "Boise,ID",
    "Springfield,IL",
    "Indianapolis,IN",
    "Des Moines,IA",
    "Topeka,KS",
    "Frankfort,KY",
    "Baton Rouge,LA",
    "Augusta,ME",
    "Annapolis,MD",
    "Boston,MA",
    "Lansing,MI",
    "Saint Paul,MN",
    "Jackson,MS",
    "Jefferson City,MO",
    "Helena,MT",
    "Lincoln,NE",
    "Carson City,NV",
    "Concord,NH",
    "Trenton,NJ",
    "Santa Fe,NM",
    "Albany,NY",
    "Raleigh,NC",
    "Bismarck,ND",
    "Columbus,OH",
    "Oklahoma City,OK",
    "Salem,OR",
    "Harrisburg,PA",
    "Providence,RI",
    "Columbia,SC",
    "Pierre,SD",
    "Nashville,TN",
    "Austin,TX",
    "Salt Lake City,UT",
    "Montpelier,VT",
    "Richmond,VA",
    "Olympia,WA",
    "Charleston,WV",
    "Madison,WI",
    "Cheyenne,WY",
  ].map((s) => s.toLowerCase())
);

/** National significance: capitals, top metros, and flagship destinations. */
export function nationalSignificanceScore(seed: Pick<
  UsMarketSeedInput,
  "primary_city" | "state_code" | "population_rank" | "market_type" | "tourism_priority"
>): number {
  let score = 0;
  const key = `${seed.primary_city},${seed.state_code}`.toLowerCase();
  if (STATE_CAPITALS.has(key)) score += 35;
  if (seed.population_rank != null && seed.population_rank <= 10) score += 50;
  else if (seed.population_rank != null && seed.population_rank <= 25) score += 35;
  else if (seed.population_rank != null && seed.population_rank <= 50) score += 20;
  else if (seed.population_rank != null && seed.population_rank <= 100) score += 10;
  if (seed.market_type === "tourist_destination") {
    score += Math.min(40, Math.max(0, seed.tourism_priority ?? 0) / 2);
  }
  return Math.min(100, score);
}

export function populationTierFromSeed(seed: Pick<
  UsMarketSeedInput,
  "market_type" | "population_rank"
>): PopulationTier {
  if (seed.market_type === "tourist_destination") return "tourist_destination";
  const rank = seed.population_rank ?? 999;
  if (rank <= 10) return "tier_1_national";
  if (rank <= 25) return "tier_2_major";
  if (rank <= 50) return "tier_3_regional";
  return "tier_4_emerging";
}

/** Regional coverage: reward metros that cover multiple member cities. */
export function regionalCoverageScore(seed: Pick<
  UsMarketSeedInput,
  "metro_cities" | "market_type"
>): number {
  const cities = seed.metro_cities?.length ?? 1;
  if (seed.market_type === "tourist_destination") return 15;
  if (cities >= 8) return 40;
  if (cities >= 5) return 30;
  if (cities >= 3) return 20;
  return 10;
}

export function displayNameForMarket(seed: Pick<
  UsMarketSeedInput,
  "market_name" | "primary_city" | "market_type"
>): string {
  if (seed.market_type === "major_metro") {
    return seed.primary_city;
  }
  return seed.market_name || seed.primary_city;
}
