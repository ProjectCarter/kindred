/**
 * Weather freshness gates — reject stale edition snapshots for homepage display.
 */

/** Edition-embedded weather older than this is not trusted for "current". */
export const EDITION_WEATHER_MAX_AGE_MS = 60 * 60 * 1000;

/** Minimum interval between live weather refresh calls. */
export const LIVE_WEATHER_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

/** Max age for a persisted live observation shown on cold launch. */
export const LIVE_WEATHER_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export type WeatherFreshnessMetadata = {
  /** ISO timestamp when the provider observation was retrieved/normalized. */
  retrievedAt: string;
  /** ISO timestamp when Kindred fetched from the provider. */
  fetchTimestamp: string;
  lat: number;
  lon: number;
  provider: string;
  cacheAgeMs?: number | null;
};

export function parseIsoMs(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function weatherAgeMs(
  retrievedAt: string | null | undefined,
  nowMs: number = Date.now()
): number | null {
  const at = parseIsoMs(retrievedAt);
  if (at == null) return null;
  return Math.max(0, nowMs - at);
}

export function isWeatherStale(
  retrievedAt: string | null | undefined,
  maxAgeMs: number = EDITION_WEATHER_MAX_AGE_MS,
  nowMs: number = Date.now()
): boolean {
  const age = weatherAgeMs(retrievedAt, nowMs);
  if (age == null) return true;
  return age > maxAgeMs;
}
