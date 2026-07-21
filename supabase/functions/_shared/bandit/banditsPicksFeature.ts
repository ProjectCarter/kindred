/**
 * Server mirror of `lib/edition/banditsPicksFeature.ts`.
 * Keep in sync — V1 hides the homepage desk; completeness must not block publish.
 */

/** V1 surface hidden — not a permanent removal of the feature. */
export const BANDITS_PICKS_ENABLED = false;

export function isBanditsPicksEnabled(): boolean {
  return BANDITS_PICKS_ENABLED;
}
