/**
 * Lightweight live weather for homepage hydration — no edition rebuild, no AI.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getWeatherProviders } from "./providers/index.ts";
import type { NormalizedWeatherForecast } from "./providers/types.ts";
import type { TemperatureUnit } from "./units.ts";
import type { KindredCanonicalCondition } from "./canonicalCondition.ts";
import { composeWeatherGuidanceFromSnapshot } from "./weatherGuidance.ts";
import type { KindredWeatherAlert } from "./weatherSnapshot.ts";
import {
  getCachedLiveWeather,
  LIVE_WEATHER_CACHE_TTL_MINUTES,
  LIVE_WEATHER_NORMALIZATION_VERSION,
  setCachedLiveWeather,
} from "./liveWeatherCache.ts";

export type LiveWeatherPayload = {
  observedAt: string;
  fetchedAt: string;
  expiresAt: string;
  provider: string;
  latitude: number;
  longitude: number;
  metroKey: string | null;
  city: string | null;
  unit: TemperatureUnit;
  /** Legacy WMO internal code — not for direct emoji mapping on client. */
  conditionCode: number;
  currentTempC: number;
  highTempC: number | null;
  lowTempC: number | null;
  windSpeedMs: number | null;
  alerts: KindredWeatherAlert[];
  guidanceNote: string | null;
  canonicalCondition: KindredCanonicalCondition;
  providerConditionId: number | null;
  providerMain: string | null;
  providerDescription: string | null;
  cloudPercentage: number | null;
  providerIcon?: string | null;
  isDaytime: boolean;
  emoji: string;
  conditionLabel: string;
  mappingSource: string | null;
  rawInternalCode: number;
  normalizationVersion: string;
  conditionSourceEndpoint: string | null;
  oneCallConditionId?: number | null;
  oneCallDescription?: string | null;
  oneCallClouds?: number | null;
};

export type LiveWeatherResolveSource = "live" | "server-cache";

const PROVIDER_TIMEOUT_MS = 8_000;

async function fetchFreshForecast(
  lat: number,
  lon: number
): Promise<NormalizedWeatherForecast | null> {
  for (const provider of getWeatherProviders()) {
    if (!provider.enabled) continue;
    try {
      const forecast = await Promise.race([
        provider.fetchForecast(lat, lon),
        new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), PROVIDER_TIMEOUT_MS)
        ),
      ]);
      if (forecast) {
        console.log("[live-weather] provider success", {
          provider: provider.id,
          lat: lat.toFixed(2),
          lon: lon.toFixed(2),
        });
        return forecast;
      }
    } catch (err) {
      console.warn("[live-weather] provider error", {
        provider: provider.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return null;
}

function buildLiveWeatherPayload(input: {
  forecast: NormalizedWeatherForecast;
  fetchedAt: string;
  city: string | null;
  metroKey: string | null;
  unit: TemperatureUnit;
}): LiveWeatherPayload {
  const { forecast, fetchedAt, city, metroKey, unit } = input;
  const today = forecast.daily[0];
  const current = forecast.current;
  const observedAt =
    current.observedAtUnix != null
      ? new Date(current.observedAtUnix * 1000).toISOString()
      : forecast.retrievedAt || fetchedAt;
  const expiresAt = new Date(
    Date.parse(fetchedAt) + LIVE_WEATHER_CACHE_TTL_MINUTES * 60 * 1000
  ).toISOString();

  const canonicalCondition =
    (current.canonicalCondition as KindredCanonicalCondition | null) ??
    "cloudy";
  const conditionCode = current.weatherCode;
  const emoji = current.conditionEmoji ?? "☁️";
  const conditionLabel = current.conditionLabel ?? "Cloudy";

  const snapshotForGuidance = {
    retrievedAt: observedAt,
    conditionCode,
    currentTempC: current.temperatureC,
    highTempC: today?.tempMaxC ?? null,
    lowTempC: today?.tempMinC ?? null,
    windSpeedMs: current.windSpeedMs ?? null,
    unit,
    alerts: forecast.alerts.map((a) => ({
      event: a.event,
      start: a.start,
      end: a.end,
    })),
    guidanceNote: null as string | null,
  };
  snapshotForGuidance.guidanceNote =
    composeWeatherGuidanceFromSnapshot(snapshotForGuidance);

  return {
    observedAt,
    fetchedAt,
    expiresAt,
    provider: forecast.provider,
    latitude: forecast.lat,
    longitude: forecast.lon,
    metroKey,
    city,
    unit,
    conditionCode,
    currentTempC: current.temperatureC,
    highTempC: today?.tempMaxC ?? null,
    lowTempC: today?.tempMinC ?? null,
    windSpeedMs: current.windSpeedMs ?? null,
    alerts: snapshotForGuidance.alerts,
    guidanceNote: snapshotForGuidance.guidanceNote,
    canonicalCondition,
    providerConditionId: current.providerConditionId ?? null,
    providerMain: current.providerMain ?? null,
    providerDescription: current.providerDescription ?? null,
    cloudPercentage: current.cloudPercentage ?? null,
    providerIcon: current.providerIcon ?? null,
    isDaytime: current.isDaytime ?? true,
    emoji,
    conditionLabel,
    mappingSource: current.conditionMappingSource ?? null,
    rawInternalCode: current.weatherCode,
    normalizationVersion: LIVE_WEATHER_NORMALIZATION_VERSION,
    conditionSourceEndpoint: current.conditionSourceEndpoint ?? null,
    oneCallConditionId: current.oneCallConditionId ?? null,
    oneCallDescription: current.oneCallDescription ?? null,
    oneCallClouds: current.oneCallClouds ?? null,
  };
}

export async function resolveLiveWeather(input: {
  admin: SupabaseClient;
  lat: number;
  lon: number;
  city?: string | null;
  metroKey?: string | null;
  unit: TemperatureUnit;
}): Promise<{ weather: LiveWeatherPayload; source: LiveWeatherResolveSource } | null> {
  const { admin, lat, lon } = input;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const cached = await getCachedLiveWeather(admin, lat, lon);
  if (cached) {
    console.log("[live-weather] cache hit", {
      lat: lat.toFixed(2),
      lon: lon.toFixed(2),
      provider: cached.provider,
      canonicalCondition: cached.canonicalCondition,
    });
    return { weather: cached, source: "server-cache" };
  }

  const forecast = await fetchFreshForecast(lat, lon);
  if (!forecast) {
    console.warn("[live-weather] all providers failed", {
      lat: lat.toFixed(2),
      lon: lon.toFixed(2),
    });
    return null;
  }

  const fetchedAt = new Date().toISOString();
  const payload = buildLiveWeatherPayload({
    forecast,
    fetchedAt,
    city: input.city?.trim() || null,
    metroKey: input.metroKey?.trim() || null,
    unit: input.unit,
  });

  await setCachedLiveWeather(admin, lat, lon, payload);
  return { weather: payload, source: "live" };
}
