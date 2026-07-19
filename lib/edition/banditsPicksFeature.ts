/**
 * Bandit's Picks — Version 1 surface gate.
 *
 * Generation may still write `editions.bandit.pick`. The homepage must not
 * render or require the pick while this flag is false.
 *
 * Restore later: set `BANDITS_PICKS_ENABLED` to `true` (and the server mirror).
 */

/** Temporary V1 disable — not a permanent deletion of the feature. */
export const BANDITS_PICKS_ENABLED = false;

export function isBanditsPicksEnabled(): boolean {
  return BANDITS_PICKS_ENABLED;
}
