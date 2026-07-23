import type {
  MARKET_BUILD_JOB_TYPE,
  MARKET_BUILD_LOG_STATUS,
  MARKET_STATUS,
  MARKET_TYPE,
  POPULATION_TIER,
} from "./constants.ts";
import type { PopulationTier } from "./marketRolloutScoring.ts";

export type UsMarketStatus = (typeof MARKET_STATUS)[number];
export type UsMarketType = (typeof MARKET_TYPE)[number];
export type UsPopulationTier = (typeof POPULATION_TIER)[number];
export type MarketBuildJobType = (typeof MARKET_BUILD_JOB_TYPE)[number];
export type MarketBuildLogStatus = (typeof MARKET_BUILD_LOG_STATUS)[number];

export type UsMarketRecord = {
  id: string;
  slug: string;
  metro_key: string;
  /** Reader-facing city label — e.g. Seattle, Sedona */
  display_name: string;
  market_name: string;
  primary_city: string;
  state_name: string;
  state_code: string;
  country_code: "US";
  market_type: UsMarketType;
  population: number | null;
  population_rank: number | null;
  population_tier: UsPopulationTier;
  tourism_rank: number | null;
  tourism_priority: number;
  regional_priority: number;
  national_significance_score: number;
  future_user_demand_score: number;
  overall_rank: number;
  /** Same as overall_rank — explicit rollout sequence */
  rollout_priority: number;
  latitude: number;
  longitude: number;
  timezone: string;
  default_radius_miles: number;
  fallback_radius_miles: number;
  metro_cities: string[];
  status: UsMarketStatus;
  is_supported: boolean;
  is_daily_refresh_enabled: boolean;
  last_built_at: string | null;
  last_refreshed_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_error: string | null;
  last_build_duration_ms: number | null;
  completeness: MarketCompletenessReport | null;
  created_at: string;
  updated_at: string;
};

export type MarketCompletenessSection = {
  id: string;
  label: string;
  complete: boolean;
  required: boolean;
  detail?: string | null;
};

export type MarketCompletenessReport = {
  /** All required validation desks passed */
  complete: boolean;
  /** Catalog foundation bootstrapped (events, activities, food) */
  foundationComplete: boolean;
  needsAttention: boolean;
  sections: MarketCompletenessSection[];
  deficiencies: string[];
  assessedAt?: string;
};

export type UsMarketCatalogEntry = {
  metro_key: string;
  display_name: string;
  state: string;
  latitude: number;
  longitude: number;
  search_radius_miles: number;
  timezone: string;
  population_tier: UsPopulationTier;
  tourism_priority: number;
  rollout_priority: number;
  status: UsMarketStatus;
  slug: string;
  market_type: UsMarketType;
  overall_rank: number;
};

export type MarketBuildLogRecord = {
  id: string;
  market_id: string;
  slug: string;
  state_code: string;
  country_code: "US";
  job_type: MarketBuildJobType;
  status: MarketBuildLogStatus;
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  sections_requested: string[];
  sections_completed: string[];
  sections_missing: string[];
  api_providers: string[];
  api_call_counts: Record<string, number>;
  ai_model_usage: Record<string, unknown> | null;
  token_usage: Record<string, unknown> | null;
  estimated_cost_usd: number | null;
  cost_available: boolean;
  error_details: string | null;
  retry_count: number;
  completeness: MarketCompletenessReport | null;
};

export type UsMarketSeedInput = {
  slug: string;
  metro_key: string;
  display_name: string;
  market_name: string;
  primary_city: string;
  state_name: string;
  state_code: string;
  market_type: UsMarketType;
  population: number | null;
  population_rank: number | null;
  population_tier?: PopulationTier;
  tourism_rank?: number | null;
  tourism_priority?: number;
  regional_priority?: number;
  national_significance_score?: number;
  future_user_demand_score?: number;
  latitude: number;
  longitude: number;
  timezone: string;
  metro_cities?: string[];
};
