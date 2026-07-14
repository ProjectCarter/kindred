import type { RankedDiscoveryItem } from "./discovery";

/** Front page caps at this; the full "See all" screen passes a larger value. */
export const RECOMMENDATIONS_GRID_LIMIT = 8;

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
