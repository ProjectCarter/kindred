/**
 * Server mirror of `lib/edition/banditsPicksFeature.ts`.
 * Keep in sync — Bandit's Picks completeness must not block publish in V1.
 */

/** Temporary V1 disable — not a permanent deletion of the feature. */
export const BANDITS_PICKS_ENABLED = false;

export function isBanditsPicksEnabled(): boolean {
  return BANDITS_PICKS_ENABLED;
}
