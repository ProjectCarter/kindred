/**
 * Kindred editorial standard — shared across Local Events, Recommendations,
 * Activities, and Bandit's Picks.
 *
 * Kindred is a local daily newspaper, not a "things to do today" app.
 * Discover and rank content relevant within the next 30 days, within
 * 25 miles of the reader. Quality over quantity.
 */

export const KINDRED_EDITORIAL_HORIZON_DAYS = 30;
export const KINDRED_LOCAL_RADIUS_MILES = 25;
export const KINDRED_LOCAL_RADIUS_KM =
  KINDRED_LOCAL_RADIUS_MILES * 1.609344;

/** Limited-time and plan-ahead experiences worth surfacing this month. */
export const PLANNING_VALUE_PATTERN =
  /\b(festival|fair|farmers? market|concert|live music|comedy|theater|theatre|exhibit|exhibition|pop[- ]?up|seasonal|limited.?time|opening weekend|this weekend|next weekend|u-pick|harvest|workshop|class(es)?|family fun|community celebration|sporting event|tournament|market day)\b/i;

/**
 * Discovery Score bands (0–100) — shared editorial desirability thresholds.
 *
 * Phase 0 infrastructure: this is the single canonical source for the bands.
 * It is intentionally not yet consumed by any ranking or publishing gate, so
 * declaring it changes no runtime behavior.
 */
export const DISCOVERY_SCORE_BANDS = {
  /** Exceptional — "must discover." Feature prominently. */
  feature: 90,
  /** Strong recommendation. */
  strong: 75,
  /** Acceptable — the minimum to publish. */
  acceptable: 50,
} as const;

export type DiscoveryScoreBand = keyof typeof DISCOVERY_SCORE_BANDS;

/**
 * The Four Reactions every published item should provoke. Shared enum-like
 * constant plus union type. Infrastructure only — nothing tags items yet.
 */
export const KINDRED_REACTIONS = {
  wantToGo: "want_to_go",
  wantToEat: "want_to_eat",
  wantToDo: "want_to_do",
  gladILearned: "glad_i_learned",
} as const;

export type KindredReaction =
  (typeof KINDRED_REACTIONS)[keyof typeof KINDRED_REACTIONS];

/**
 * Canonical editorial-dimension names. These mirror the eight
 * KindredEventEditorialDimensions already used by the Local Events editorial
 * score (localEvents/editorialScore.ts), declared once so future cross-desk
 * scoring reuses the same names instead of redefining them.
 */
export const EDITORIAL_DIMENSIONS = [
  "editorialQuality",
  "localRelevance",
  "communityInterest",
  "uniqueness",
  "timeliness",
  "seasonalRelevance",
  "worthLeavingHouse",
  "familyFriendliness",
] as const;

export type EditorialDimension = (typeof EDITORIAL_DIMENSIONS)[number];
