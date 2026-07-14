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
