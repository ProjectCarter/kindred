/**
 * Whether a metro should receive History of Your City on the homepage.
 * Seeded metros are a fast client-side hint; server completeness uses
 * kindred_city_articles approval_status as source of truth.
 */

export const SEEDED_STORY_OF_METROS = ["gilbert-az", "seattle-wa"] as const;

export function metroExpectsStoryOf(metroKey: string | null | undefined): boolean {
  if (!metroKey?.trim()) return false;
  return (SEEDED_STORY_OF_METROS as readonly string[]).includes(metroKey.trim());
}

/** Homepage folio order for major narrative desks (after Local Events / discovery). */
export const STORY_OF_HOMEPAGE_DESK_ORDER = [
  "activities",
  "recommendations",
  "story_of",
  "today_in_history",
  "bandits_pick",
] as const;

export type HomepageDeskId = (typeof STORY_OF_HOMEPAGE_DESK_ORDER)[number];

export function homepageDeskPresence(input: {
  hasActivities: boolean;
  hasRecommendations: boolean;
  hasStoryOf: boolean;
  hasTodayInHistory: boolean;
  hasBanditsPick: boolean;
}): Record<HomepageDeskId, boolean> {
  return {
    activities: input.hasActivities,
    recommendations: input.hasRecommendations,
    story_of: input.hasStoryOf,
    today_in_history: input.hasTodayInHistory,
    bandits_pick: input.hasBanditsPick,
  };
}

/**
 * Returns desk ids in homepage render order for desks that are present.
 * Used by regression tests — mirrors EditionReader folio sequence.
 */
export function homepageDesksInRenderOrder(
  presence: Record<HomepageDeskId, boolean>
): HomepageDeskId[] {
  return STORY_OF_HOMEPAGE_DESK_ORDER.filter((desk) => presence[desk]);
}
