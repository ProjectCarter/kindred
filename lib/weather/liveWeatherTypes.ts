/**
 * Live homepage weather — separate from the prebuilt edition snapshot.
 */

import type { TemperatureUnit } from "./units.ts";
import type { KindredWeatherAlert } from "./weatherSnapshot.ts";
import type { KindredCanonicalCondition } from "./canonicalCondition.ts";
import { guideKeyFromCanonical } from "./canonicalCondition.ts";
import type { WeatherConditionDisplay, WeatherConditionKey } from "./weatherEmojiGuide.ts";
import { homepageConditionFromCode } from "./conditionDisplay.ts";
import { weatherConditionKeyFromWmo } from "./weatherEmojiGuide.ts";

/** How the homepage resolved weather for display (dev diagnostics). */
export type LiveWeatherDisplaySource =
  | "live"
  | "server-cache"
  | "client-cache"
  | "edition-fallback";

export type LiveWeatherResponse = {
  /** Provider observation timestamp (ISO). */
  observedAt: string;
  /** When Kindred fetched this payload (ISO). */
  fetchedAt: string;
  /** Client/server freshness boundary (ISO). */
  expiresAt: string;
  provider: string;
  latitude: number;
  longitude: number;
  metroKey: string | null;
  city: string | null;
  unit: TemperatureUnit;
  conditionCode: number;
  currentTempC: number;
  highTempC: number | null;
  lowTempC: number | null;
  windSpeedMs: number | null;
  alerts: KindredWeatherAlert[];
  guidanceNote: string | null;
  canonicalCondition?: KindredCanonicalCondition | null;
  providerConditionId?: number | null;
  providerMain?: string | null;
  providerDescription?: string | null;
  cloudPercentage?: number | null;
  isDaytime?: boolean;
  emoji?: string | null;
  conditionLabel?: string | null;
  mappingSource?: string | null;
  rawInternalCode?: number | null;
};

/** Client-side freshness window — matches server TTL (~12 min) with slack. */
export const LIVE_WEATHER_CLIENT_FRESH_MS = 15 * 60 * 1000;

/** Shared metro cache TTL on the server. */
export const LIVE_WEATHER_SERVER_TTL_MINUTES = 12;

export function liveWeatherRequestKey(
  metroKey: string,
  lat: number,
  lon: number
): string {
  return `${metroKey}:${lat.toFixed(4)},${lon.toFixed(4)}`;
}

export function shouldRefreshLiveWeather(
  weather: LiveWeatherResponse | null | undefined
): boolean {
  if (!weather) return true;
  return !isLiveWeatherFresh(weather);
}

export function parseLiveWeatherResponse(value: unknown): LiveWeatherResponse | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const observedAt =
    typeof row.observedAt === "string" ? row.observedAt.trim() : "";
  const fetchedAt = typeof row.fetchedAt === "string" ? row.fetchedAt.trim() : "";
  const expiresAt = typeof row.expiresAt === "string" ? row.expiresAt.trim() : "";
  const provider = typeof row.provider === "string" ? row.provider.trim() : "";
  const latitude = Number(row.latitude);
  const longitude = Number(row.longitude);
  const conditionCode = Number(row.conditionCode);
  const currentTempC = Number(row.currentTempC);

  if (
    !observedAt ||
    !fetchedAt ||
    !expiresAt ||
    !provider ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(conditionCode) ||
    !Number.isFinite(currentTempC)
  ) {
    return null;
  }

  const unit = row.unit === "celsius" ? "celsius" : "fahrenheit";
  const alerts = Array.isArray(row.alerts)
    ? row.alerts
        .map((a) => {
          if (!a || typeof a !== "object") return null;
          const alert = a as Record<string, unknown>;
          const event = typeof alert.event === "string" ? alert.event.trim() : "";
          if (!event) return null;
          return {
            event,
            start: Number(alert.start) || 0,
            end: Number(alert.end) || 0,
          };
        })
        .filter((a): a is KindredWeatherAlert => Boolean(a))
    : [];

  return {
    observedAt,
    fetchedAt,
    expiresAt,
    provider,
    latitude,
    longitude,
    metroKey:
      typeof row.metroKey === "string" ? row.metroKey.trim() || null : null,
    city: typeof row.city === "string" ? row.city.trim() || null : null,
    unit,
    conditionCode,
    currentTempC,
    highTempC: Number.isFinite(Number(row.highTempC))
      ? Number(row.highTempC)
      : null,
    lowTempC: Number.isFinite(Number(row.lowTempC))
      ? Number(row.lowTempC)
      : null,
    windSpeedMs: Number.isFinite(Number(row.windSpeedMs))
      ? Number(row.windSpeedMs)
      : null,
    alerts,
    guidanceNote:
      typeof row.guidanceNote === "string" ? row.guidanceNote.trim() || null : null,
    canonicalCondition: parseCanonicalCondition(row.canonicalCondition),
    providerConditionId: Number.isFinite(Number(row.providerConditionId))
      ? Number(row.providerConditionId)
      : null,
    providerMain:
      typeof row.providerMain === "string" ? row.providerMain.trim() || null : null,
    providerDescription:
      typeof row.providerDescription === "string"
        ? row.providerDescription.trim() || null
        : null,
    cloudPercentage: Number.isFinite(Number(row.cloudPercentage))
      ? Number(row.cloudPercentage)
      : null,
    isDaytime: typeof row.isDaytime === "boolean" ? row.isDaytime : undefined,
    emoji: typeof row.emoji === "string" ? row.emoji : null,
    conditionLabel:
      typeof row.conditionLabel === "string" ? row.conditionLabel.trim() || null : null,
    mappingSource:
      typeof row.mappingSource === "string" ? row.mappingSource.trim() || null : null,
    rawInternalCode: Number.isFinite(Number(row.rawInternalCode))
      ? Number(row.rawInternalCode)
      : null,
  };
}

const CANONICAL_CONDITIONS = new Set<KindredCanonicalCondition>([
  "clear",
  "mostly_clear",
  "partly_cloudy",
  "mostly_cloudy",
  "cloudy",
  "fog",
  "rain",
  "thunderstorms",
  "snow",
  "wind",
  "severe",
]);

function parseCanonicalCondition(value: unknown): KindredCanonicalCondition | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim() as KindredCanonicalCondition;
  return CANONICAL_CONDITIONS.has(trimmed) ? trimmed : null;
}

export function liveWeatherConditionDisplay(
  weather: LiveWeatherResponse
): WeatherConditionDisplay | null {
  if (weather.conditionLabel && weather.emoji) {
    const key: WeatherConditionKey =
      (weather.canonicalCondition
        ? guideKeyFromCanonical(weather.canonicalCondition)
        : weatherConditionKeyFromWmo(
            weather.conditionCode,
            weather.windSpeedMs
          )) ?? "partly_cloudy";
    return {
      key,
      emoji: weather.emoji,
      label: weather.conditionLabel,
    };
  }
  return homepageConditionFromCode(weather.conditionCode, weather.windSpeedMs);
}

export function isLiveWeatherFresh(
  weather: LiveWeatherResponse,
  nowMs = Date.now()
): boolean {
  const expires = Date.parse(weather.expiresAt);
  if (Number.isFinite(expires)) return expires > nowMs;
  const fetched = Date.parse(weather.fetchedAt);
  if (!Number.isFinite(fetched)) return false;
  return nowMs - fetched <= LIVE_WEATHER_CLIENT_FRESH_MS;
}

export function liveWeatherAgeMinutes(
  weather: LiveWeatherResponse,
  nowMs = Date.now()
): number | null {
  const fetched = Date.parse(weather.fetchedAt);
  if (!Number.isFinite(fetched)) return null;
  return Math.round((nowMs - fetched) / 60_000);
}

export function liveWeatherToSnapshot(
  weather: LiveWeatherResponse
): import("./weatherSnapshot.ts").KindredWeatherSnapshot {
  return {
    retrievedAt: weather.observedAt,
    conditionCode: weather.conditionCode,
    currentTempC: weather.currentTempC,
    highTempC: weather.highTempC,
    lowTempC: weather.lowTempC,
    windSpeedMs: weather.windSpeedMs,
    unit: weather.unit,
    alerts: weather.alerts,
    guidanceNote: weather.guidanceNote,
  };
}
