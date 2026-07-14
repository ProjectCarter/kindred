import type { RankedDiscoveryItem } from "./discovery";
import { HOMEPAGE_INITIAL_RENDER_COUNT } from "./editorialPublishing";

/** Homepage first paint — rendering only, not a publication cap. */
export const RECOMMENDATIONS_GRID_LIMIT = HOMEPAGE_INITIAL_RENDER_COUNT;

/**
 * In-memory handoff of today's full Recommendations list, for the "See all
 * N recommendations →" destination screen. Same reasoning as
 * eventsListStore — router params are too small to carry a full list, and
 * there's only ever one "today" in play at a time, so a single slot (not
 * a map) is enough.
 */
let todaysRecommendations: RankedDiscoveryItem[] = [];

export function stashTodaysRecommendations(items: RankedDiscoveryItem[]): void {
  todaysRecommendations = items;
}

export function getTodaysRecommendations(): RankedDiscoveryItem[] {
  return todaysRecommendations;
}
