/**
 * Homepage desk order — Local Events through Story of Your City.
 * Food & Drinks sits after Activities and before Story of.
 */

export const HOMEPAGE_DESK_ORDER = [
  "local_events",
  "activities",
  "food_drinks",
  "story_of",
] as const;

export type HomepageDeskId = (typeof HOMEPAGE_DESK_ORDER)[number];

export function homepageDeskIndex(desk: HomepageDeskId): number {
  return HOMEPAGE_DESK_ORDER.indexOf(desk);
}

export function isHomepageDeskBefore(
  earlier: HomepageDeskId,
  later: HomepageDeskId
): boolean {
  return homepageDeskIndex(earlier) < homepageDeskIndex(later);
}
