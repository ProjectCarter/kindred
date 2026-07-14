import type { RankedDiscoveryItem } from "./discovery";

import { HOMEPAGE_INITIAL_RENDER_COUNT } from "./editorialPublishing";

/** Homepage first paint — rendering only, not a publication cap. */
export const ACTIVITIES_GRID_LIMIT = HOMEPAGE_INITIAL_RENDER_COUNT;

/**
 * In-memory handoff of today's full Activities list, for the "See all N
 * activities →" destination screen. Same reasoning as eventsListStore —
 * router params are too small to carry a full list, and there's only ever
 * one "today" in play at a time, so a single slot (not a map) is enough.
 */
let todaysActivities: RankedDiscoveryItem[] = [];

export function stashTodaysActivities(items: RankedDiscoveryItem[]): void {
  todaysActivities = items;
}

export function getTodaysActivities(): RankedDiscoveryItem[] {
  return todaysActivities;
}
