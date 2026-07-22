/**
 * Build structured weather snapshot from normalized provider output.
 */

import type { NormalizedWeatherForecast } from "./providers/types.ts";
import type { TemperatureUnit } from "./units.ts";
import { composeWeatherGuidanceFromSnapshot } from "./weatherGuidance.ts";
import { validateWeatherSnapshot, WEATHER_PUBLISH_MAX_AGE_MS } from "./weatherValidation.ts";

export type KindredWeatherAlert = {
  event: string;
  start: number;
  end: number;
};

export type KindredWeatherSnapshot = {
  retrievedAt: string;
  conditionCode: number;
  currentTempC: number;
  highTempC: number | null;
  lowTempC: number | null;
  windSpeedMs: number | null;
  unit: TemperatureUnit;
  alerts: KindredWeatherAlert[];
  guidanceNote: string | null;
};

export function buildWeatherSnapshot(input: {
  forecast: NormalizedWeatherForecast;
  unit: TemperatureUnit;
}): KindredWeatherSnapshot | null {
  const { forecast, unit } = input;
  const today = forecast.daily[0];
  const currentC = forecast.current.temperatureC;
  const conditionCode = forecast.current.weatherCode;

  if (!Number.isFinite(currentC) || !Number.isFinite(conditionCode)) {
    return null;
  }

  const snapshot: KindredWeatherSnapshot = {
    retrievedAt: forecast.retrievedAt,
    conditionCode,
    currentTempC: currentC,
    highTempC: today?.tempMaxC ?? null,
    lowTempC: today?.tempMinC ?? null,
    windSpeedMs: forecast.current.windSpeedMs ?? null,
    unit,
    alerts: forecast.alerts.map((a) => ({
      event: a.event,
      start: a.start,
      end: a.end,
    })),
    guidanceNote: null,
  };

  const validation = validateWeatherSnapshot(snapshot, {
    maxAgeMs: WEATHER_PUBLISH_MAX_AGE_MS,
  });
  if (!validation.ok) {
    console.warn("[weather] snapshot rejected at build", {
      reasons: validation.reasons,
      retrievedAt: snapshot.retrievedAt,
    });
    return null;
  }

  snapshot.guidanceNote = composeWeatherGuidanceFromSnapshot(snapshot);
  return snapshot;
}
