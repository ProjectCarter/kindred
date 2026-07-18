/** Kindred US market rollout — Version 1 constants. */

export const KINDRED_COUNTRY_CODE_US = "US" as const;

export const KINDRED_MARKET_DEFAULT_RADIUS_MILES = 25;
export const KINDRED_MARKET_FALLBACK_RADIUS_MILES = 50;

export const MARKET_STATUS = [
  "planned",
  "building",
  "ready",
  "complete",
  "needs_attention",
  "paused",
] as const;

export const POPULATION_TIER = [
  "tier_1_national",
  "tier_2_major",
  "tier_3_regional",
  "tier_4_emerging",
  "tourist_destination",
] as const;

export const MARKET_TYPE = [
  "major_metro",
  "tourist_destination",
  "regional_city",
] as const;

export const MARKET_BUILD_JOB_TYPE = ["build", "refresh", "retry"] as const;

export const MARKET_BUILD_LOG_STATUS = [
  "running",
  "succeeded",
  "failed",
  "partial",
] as const;

/** Mass batch actions remain disabled until explicitly approved. */
export const MARKET_BATCH_ACTIONS_ENABLED = false;

export const MARKET_BUILD_LOCK_MS = 45 * 60 * 1000;

export const SUPPORTED_REGION_MESSAGE =
  "Kindred is currently available in the United States.";
