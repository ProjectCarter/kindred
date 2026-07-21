/**
 * Bandit's Picks — Version 1 surface gate.
 *
 * Product decision (V1): hide the Bandit's Pick desk from the homepage and
 * daily edition while core desks are polished (Local Events, Activities,
 * Food & Drinks, Local News). Bandit remains in the greeting, masthead, and
 * editorial voice everywhere else.
 *
 * What stays on while this flag is false:
 * - Edition build may still run `selectBanditsPick` and persist `bandit.pick`
 * - All types, adapters, tests, and server editorial logic remain in place
 * - Completeness gates treat a missing pick as optional (see editionCompleteness)
 *
 * What stays off:
 * - Homepage / EditionReader section render
 * - `banditsPick()` parse for UI (returns null)
 * - Continue-reading Bandit pick suggestions
 * - Discovery surface fallback via `bandits_picks`
 *
 * Re-enable when picks consistently meet the editorial bar: set
 * `BANDITS_PICKS_ENABLED` to `true` here and in the server mirror.
 */

/** V1 surface hidden — not a permanent removal of the feature. */
export const BANDITS_PICKS_ENABLED = false;

export function isBanditsPicksEnabled(): boolean {
  return BANDITS_PICKS_ENABLED;
}
