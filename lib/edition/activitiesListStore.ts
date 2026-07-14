import type { RankedDiscoveryItem } from "./discovery";

/** Front page caps at this; the full "See all" screen passes a larger value. */
export const ACTIVITIES_GRID_LIMIT = 8;

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
