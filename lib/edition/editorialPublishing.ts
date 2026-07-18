/**
 * Editorial Publishing — client mirror of server publishing rules.
 * Quality determines publication; homepage caps are rendering-only.
 */

/** Minimum discovery score to appear in a published section. */
export const DISCOVERY_PUBLISH_MIN_SCORE = 48;

/** Minimum local event score for publication (mirrors server ranking). */
export const LOCAL_EVENT_PUBLISH_MIN_SCORE = 14;

/** Homepage first paint — not a publication limit. */
export const HOMEPAGE_INITIAL_RENDER_COUNT = 8;

/** See All destination cap — curated exploration, not a directory dump. */
export const SEE_ALL_MAX_ITEMS = 20;

/** @deprecated Alias — Local Events edition cap matches See All max. */
export const LOCAL_EVENTS_EDITION_SURFACED_MAX = SEE_ALL_MAX_ITEMS;

/** @deprecated Rendering-only alias — use HOMEPAGE_INITIAL_RENDER_COUNT */
export const LOCAL_EVENTS_GRID_LIMIT = HOMEPAGE_INITIAL_RENDER_COUNT;

export function meetsDiscoveryPublishThreshold(score: number): boolean {
  return score >= DISCOVERY_PUBLISH_MIN_SCORE;
}

export function meetsLocalEventPublishThreshold(score: number): boolean {
  return score >= LOCAL_EVENT_PUBLISH_MIN_SCORE;
}

/** Slice for homepage initial render — does not alter the stored edition. */
export function sliceForInitialRender<T>(
  items: readonly T[],
  count: number = HOMEPAGE_INITIAL_RENDER_COUNT
): T[] {
  return items.slice(0, count);
}

/** Cap See All lists — mission rule: up to 20 curated results per section. */
export function sliceForSeeAll<T>(
  items: readonly T[],
  count: number = SEE_ALL_MAX_ITEMS
): T[] {
  return items.slice(0, count);
}
