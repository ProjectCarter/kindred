import {
  isWeatherStale,
  LIVE_WEATHER_CACHE_MAX_AGE_MS,
  type WeatherFreshnessMetadata,
} from "./weatherFreshness.ts";

export type LiveWeatherSnapshot = WeatherFreshnessMetadata & {
  weatherSummary: string;
  conditionCode: number | null;
  currentC: number | null;
  highC: number | null;
  lowC: number | null;
};

export function isValidLiveWeatherSnapshot(
  raw: unknown,
  maxAgeMs: number = LIVE_WEATHER_CACHE_MAX_AGE_MS
): raw is LiveWeatherSnapshot {
  if (!raw || typeof raw !== "object") return false;
  const snapshot = raw as LiveWeatherSnapshot;
  if (!snapshot.weatherSummary?.trim() || !snapshot.retrievedAt?.trim()) {
    return false;
  }
  if (
    !Number.isFinite(snapshot.lat) ||
    !Number.isFinite(snapshot.lon) ||
    !snapshot.fetchTimestamp?.trim() ||
    !snapshot.provider?.trim()
  ) {
    return false;
  }
  return !isWeatherStale(snapshot.retrievedAt, maxAgeMs);
}
