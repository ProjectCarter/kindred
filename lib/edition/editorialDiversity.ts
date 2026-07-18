/**
 * Editorial spread selection — newspaper layout engine for homepage desks.
 *
 * Applies soft diversity penalties (venue, geography, category) while preserving
 * base editorial rank. Hard venue caps relax only when the pool cannot fill the spread.
 *
 * Reusable for Local Events, Food & Drinks, Activities, and Bandit's Picks.
 */

export type EditorialDiversityWeights = {
  /** Maximum appearances of the same venue in the spread (homepage: 1). */
  maxVenueAppearances: number;
  /** Soft score penalty per prior pick at the same venue. */
  venueRepeatPenalty: number;
  /** Soft score penalty per prior pick in the same geography bucket. */
  geographyRepeatPenalty: number;
  /** Soft score penalty per prior pick in the same category bucket. */
  categoryRepeatPenalty: number;
};

export const DEFAULT_EDITORIAL_DIVERSITY_WEIGHTS: EditorialDiversityWeights = {
  maxVenueAppearances: 1,
  venueRepeatPenalty: 18,
  geographyRepeatPenalty: 6,
  categoryRepeatPenalty: 8,
};

/** Homepage Local Events — strong venue cap, meaningful geo + category spread. */
export const LOCAL_EVENTS_HOMEPAGE_DIVERSITY_WEIGHTS: EditorialDiversityWeights = {
  maxVenueAppearances: 1,
  venueRepeatPenalty: 22,
  geographyRepeatPenalty: 7,
  categoryRepeatPenalty: 9,
};

export type EditorialSpreadConfig<T> = {
  maxSlots: number;
  getBaseScore: (item: T) => number;
  /** Stable dedupe key — same listing twice. */
  getItemKey: (item: T) => string;
  getVenueKey?: (item: T) => string | null;
  getGeographyKey?: (item: T) => string | null;
  getCategoryKey?: (item: T) => string | null;
  /** Hard skip — e.g. same venue + nearly identical title. */
  isNearDuplicate?: (picked: T, candidate: T) => boolean;
  /**
   * Optional boost when a desk/category quota is unfilled (newspaper section balance).
   * Receives live counts keyed by getCategoryKey.
   */
  getCategoryTargetBoost?: (
    item: T,
    categoryCounts: ReadonlyMap<string, number>
  ) => number;
  weights?: Partial<EditorialDiversityWeights>;
};

export type EditorialSpreadResult<T> = {
  selected: T[];
  remainder: T[];
};

export function normalizeSpreadKey(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed.replace(/\s+/g, " ");
}

export function countSpreadKey(
  picked: readonly unknown[],
  getKey: ((item: unknown) => string | null) | undefined
): Map<string, number> {
  const counts = new Map<string, number>();
  if (!getKey) return counts;
  for (const item of picked) {
    const key = normalizeSpreadKey(getKey(item));
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function computeEditorialDiversityPenalty<T>(
  candidate: T,
  picked: readonly T[],
  config: Pick<
    EditorialSpreadConfig<T>,
    "getVenueKey" | "getGeographyKey" | "getCategoryKey"
  >,
  weights: EditorialDiversityWeights
): number {
  let penalty = 0;

  const venue = normalizeSpreadKey(config.getVenueKey?.(candidate) ?? null);
  if (venue) {
    const prior = picked.filter(
      (item) => normalizeSpreadKey(config.getVenueKey?.(item) ?? null) === venue
    ).length;
    penalty += prior * weights.venueRepeatPenalty;
  }

  const geography = normalizeSpreadKey(config.getGeographyKey?.(candidate) ?? null);
  if (geography) {
    const prior = picked.filter(
      (item) =>
        normalizeSpreadKey(config.getGeographyKey?.(item) ?? null) === geography
    ).length;
    penalty += prior * weights.geographyRepeatPenalty;
  }

  const category = normalizeSpreadKey(config.getCategoryKey?.(candidate) ?? null);
  if (category) {
    const prior = picked.filter(
      (item) => normalizeSpreadKey(config.getCategoryKey?.(item) ?? null) === category
    ).length;
    penalty += prior * weights.categoryRepeatPenalty;
  }

  return penalty;
}

/**
 * Whether a candidate venue may join the spread.
 * Blocks a repeat venue when enough fresh venues remain to fill open slots.
 */
export function isVenueEligibleForSpread<T>(
  candidate: T,
  picked: readonly T[],
  unpicked: readonly T[],
  slotsRemaining: number,
  config: Pick<EditorialSpreadConfig<T>, "getVenueKey">,
  weights: EditorialDiversityWeights
): boolean {
  const venue = normalizeSpreadKey(config.getVenueKey?.(candidate) ?? null);
  if (!venue) return true;

  const priorAtVenue = picked.filter(
    (item) => normalizeSpreadKey(config.getVenueKey?.(item) ?? null) === venue
  ).length;
  if (priorAtVenue < weights.maxVenueAppearances) return true;

  const pickedVenues = new Set(
    picked
      .map((item) => normalizeSpreadKey(config.getVenueKey?.(item) ?? null))
      .filter((key): key is string => Boolean(key))
  );

  const freshVenues = new Set<string>();
  for (const item of unpicked) {
    const key = normalizeSpreadKey(config.getVenueKey?.(item) ?? null);
    if (key && !pickedVenues.has(key)) freshVenues.add(key);
  }

  return freshVenues.size < slotsRemaining;
}

function isNearDuplicateCandidate<T>(
  candidate: T,
  picked: readonly T[],
  isNearDuplicate?: (picked: T, candidate: T) => boolean
): boolean {
  if (!isNearDuplicate) return false;
  return picked.some((item) => isNearDuplicate(item, candidate));
}

function adjustedSpreadScore<T>(
  candidate: T,
  picked: readonly T[],
  categoryCounts: ReadonlyMap<string, number>,
  config: EditorialSpreadConfig<T>,
  weights: EditorialDiversityWeights
): number {
  const base = config.getBaseScore(candidate);
  const boost = config.getCategoryTargetBoost?.(candidate, categoryCounts) ?? 0;
  const penalty = computeEditorialDiversityPenalty(candidate, picked, config, weights);
  return base + boost - penalty;
}

/**
 * Greedy newspaper layout — highest adjusted score each slot, diversity as soft pressure.
 */
export function selectEditorialSpread<T>(
  candidates: readonly T[],
  config: EditorialSpreadConfig<T>
): EditorialSpreadResult<T> {
  const weights: EditorialDiversityWeights = {
    ...DEFAULT_EDITORIAL_DIVERSITY_WEIGHTS,
    ...config.weights,
  };

  const selected: T[] = [];
  const selectedKeys = new Set<string>();
  const categoryCounts = new Map<string, number>();

  const addCategoryCount = (item: T) => {
    const key = normalizeSpreadKey(config.getCategoryKey?.(item) ?? null);
    if (!key) return;
    categoryCounts.set(key, (categoryCounts.get(key) ?? 0) + 1);
  };

  while (selected.length < config.maxSlots) {
    const unpicked = candidates.filter((item) => !selectedKeys.has(config.getItemKey(item)));
    if (!unpicked.length) break;

    const slotsRemaining = config.maxSlots - selected.length;

    let pool = unpicked.filter(
      (candidate) =>
        !isNearDuplicateCandidate(candidate, selected, config.isNearDuplicate) &&
        isVenueEligibleForSpread(
          candidate,
          selected,
          unpicked,
          slotsRemaining,
          config,
          weights
        )
    );

    if (!pool.length) {
      pool = unpicked.filter(
        (candidate) => !isNearDuplicateCandidate(candidate, selected, config.isNearDuplicate)
      );
    }

    if (!pool.length) break;

    let best: T | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const candidate of pool) {
      const score = adjustedSpreadScore(candidate, selected, categoryCounts, config, weights);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    if (!best) break;

    selected.push(best);
    selectedKeys.add(config.getItemKey(best));
    addCategoryCount(best);
  }

  const remainder = candidates.filter((item) => !selectedKeys.has(config.getItemKey(item)));

  return { selected, remainder };
}
