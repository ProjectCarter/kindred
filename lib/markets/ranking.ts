import type { UsMarketSeedInput } from "./types.ts";

export type RankedUsMarketSeed = UsMarketSeedInput & {
  overall_rank: number;
  ranking_score: number;
};

/**
 * Deterministic US market ranking — no AI reordering.
 * Primary: metropolitan population rank (inverse).
 * Secondary: tourism priority + tourism rank.
 * Tertiary: regional priority + future user demand.
 */
export function computeMarketRankingScore(input: {
  population_rank: number | null;
  tourism_rank: number | null;
  tourism_priority: number;
  regional_priority: number;
  national_significance_score: number;
  future_user_demand_score: number;
}): number {
  const populationComponent =
    input.population_rank != null && input.population_rank > 0
      ? Math.max(0, 101 - Math.min(input.population_rank, 100)) * 1_000
      : 0;

  const tourismRankComponent =
    input.tourism_rank != null && input.tourism_rank > 0
      ? Math.max(0, 51 - Math.min(input.tourism_rank, 50)) * 150
      : 0;

  const tourismPriorityComponent = Math.max(0, input.tourism_priority) * 250;
  const regionalComponent = Math.max(0, input.regional_priority) * 75;
  const nationalComponent = Math.max(0, input.national_significance_score) * 12;
  const demandComponent = Math.max(0, input.future_user_demand_score) * 25;

  return (
    populationComponent +
    tourismPriorityComponent +
    tourismRankComponent +
    regionalComponent +
    nationalComponent +
    demandComponent
  );
}

export function rankUsMarketSeeds(
  seeds: UsMarketSeedInput[]
): RankedUsMarketSeed[] {
  const scored = seeds.map((seed) => {
    const tourism_priority = seed.tourism_priority ?? 0;
    const tourism_rank = seed.tourism_rank ?? null;
    const regional_priority = seed.regional_priority ?? 0;
    const national_significance_score = seed.national_significance_score ?? 0;
    const future_user_demand_score = seed.future_user_demand_score ?? 0;
    const ranking_score = computeMarketRankingScore({
      population_rank: seed.population_rank,
      tourism_rank,
      tourism_priority,
      regional_priority,
      national_significance_score,
      future_user_demand_score,
    });
    return {
      ...seed,
      tourism_priority,
      tourism_rank,
      regional_priority,
      national_significance_score,
      future_user_demand_score,
      ranking_score,
      overall_rank: 0,
      rollout_priority: 0,
    };
  });

  scored.sort((a, b) => {
    if (b.ranking_score !== a.ranking_score) {
      return b.ranking_score - a.ranking_score;
    }
    if (
      (a.population_rank ?? 999) !== (b.population_rank ?? 999)
    ) {
      return (a.population_rank ?? 999) - (b.population_rank ?? 999);
    }
    return a.slug.localeCompare(b.slug);
  });

  return scored.map((row, index) => ({
    ...row,
    overall_rank: index + 1,
    rollout_priority: index + 1,
  }));
}

/** Stable slug for metro_key collisions — tourist vs metro share anchor city. */
export function usMarketSlugFromParts(input: {
  primary_city: string;
  state_code: string;
  market_type: UsMarketSeedInput["market_type"];
}): string {
  const base = `${input.primary_city}-${input.state_code}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (input.market_type === "tourist_destination") {
    return `${base}-destination`;
  }
  if (input.market_type === "regional_city") {
    return `${base}-regional`;
  }
  return `${base}-metro`;
}