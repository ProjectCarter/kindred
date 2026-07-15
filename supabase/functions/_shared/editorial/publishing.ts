/**
 * Editorial Publishing — quality determines publication, not arbitrary caps.
 *
 * Provider safety limits (retrieval only — never truncate published editions):
 * - SERPAPI_MAX_PAGES: max paginated SerpAPI requests per city fetch
 * - SERPAPI_CANDIDATE_CAP: max raw event rows retained before editorial filter
 * - FOURSQUARE_RESULT_LIMIT: per-category Foursquare page size (places/foursquareProvider.ts)
 *
 * Rendering limits (UI only — full edition stored separately):
 * - HOMEPAGE_INITIAL_RENDER_COUNT: first paint on the homepage grid
 */

import type { RankedDiscoveryItem } from "../discovery/types.ts";
import {
  attachDiscoveryConfidence,
  meetsDiscoveryConfidenceGate,
} from "./confidencePayload.ts";

/** Minimum discovery score to publish on any desk surface. */
export const DISCOVERY_PUBLISH_MIN_SCORE = 48;

/** Minimum local event editorial score — see localEvents/ranking.ts. */
export const LOCAL_EVENT_PUBLISH_MIN_SCORE = 14;

/** Homepage first paint — rendering only. */
export const HOMEPAGE_INITIAL_RENDER_COUNT = 8;

/** SerpAPI pagination safety — provider retrieval, not publication. */
export const SERPAPI_MAX_PAGES = 3;

/** Raw SerpAPI rows retained before dedupe/filter — provider retrieval. */
export const SERPAPI_CANDIDATE_CAP = 80;

export function meetsDiscoveryPublishThreshold(score: number): boolean {
  return score >= DISCOVERY_PUBLISH_MIN_SCORE;
}

/** Publish discovery candidates meeting editorial score and confidence gates. */
export function publishDiscoveryItems(
  ranked: RankedDiscoveryItem[],
  minScore: number = DISCOVERY_PUBLISH_MIN_SCORE
): RankedDiscoveryItem[] {
  return ranked
    .map((row) => ({
      ...row,
      item: attachDiscoveryConfidence(row.item),
    }))
    .filter(
      (r) =>
        r.score >= minScore && meetsDiscoveryConfidenceGate(r.item)
    )
    .sort((a, b) => b.score - a.score);
}

export function sliceForInitialRender<T>(
  items: readonly T[],
  count: number = HOMEPAGE_INITIAL_RENDER_COUNT
): T[] {
  return items.slice(0, count);
}
