/**
 * Metro section cache schema version — manually bumped when pool payload shape
 * or ranking semantics change. Not tied to mobile app build numbers.
 */

/** Current metro cache record version. Mismatch → controlled cache miss. */
export const KINDRED_METRO_CACHE_VERSION = 1;

export function isMetroCacheVersionCurrent(storedVersion: number | null | undefined): boolean {
  return Number(storedVersion) === KINDRED_METRO_CACHE_VERSION;
}
