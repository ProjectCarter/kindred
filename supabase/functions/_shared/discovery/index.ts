export type {
  DiscoveryCategory,
  DiscoveryFamily,
  DiscoveryItem,
  DiscoveryPayload,
  DiscoveryRankingContext,
  DiscoveryReason,
  DiscoverySurface,
  DiscoverySurfaceResult,
  RankedDiscoveryItem,
} from "./types.ts";

export {
  CATEGORY_FAMILY,
  SURFACE_CATEGORIES,
  SURFACE_HEADLINES,
  SURFACE_EDITOR_NOTES,
  interestToDiscoveryCategories,
  seasonForDate,
  weatherBucket,
} from "./taxonomy.ts";

export {
  TRUSTED_DISCOVERY_SOURCES,
  sourceQualityPrior,
} from "./sources.ts";

export {
  DISCOVERY_SEED_CATALOG,
  localEventsAsDiscoveryItems,
} from "./catalog.ts";

export { scoreDiscoveryItem } from "./score.ts";
export { selectDiscoverySurface, formatDiscoveryBrief } from "./select.ts";
export { runDiscoveryDecisions } from "./decide.ts";
