/**
 * Shared weather desk payload for edition build paths.
 */

import type { NormalizedWeatherForecast, WeatherIntelligence } from "./providers/types.ts";
import {
  buildWeatherIntelligence,
  weatherSourceAttribution,
  toLegacyWeatherPayload,
} from "./providers/index.ts";
import { formatWeatherSummary, type TemperatureUnit } from "./units.ts";
import { composeHeroWeatherTag } from "./heroWeatherTag.ts";
import { buildWeatherSnapshot, type KindredWeatherSnapshot } from "./weatherSnapshot.ts";

export type WeatherEditionPayload = {
  summary: string | null;
  intel: WeatherIntelligence | null;
  tag: string | null;
  attribution: string;
  snapshot: KindredWeatherSnapshot | null;
};

export function buildWeatherEditionPayload(input: {
  forecast: NormalizedWeatherForecast | null;
  city: string | null;
  unit: TemperatureUnit;
  editionDate: string;
  userId: string;
}): WeatherEditionPayload {
  if (!input.forecast) {
    return {
      summary: null,
      intel: null,
      tag: null,
      attribution: weatherSourceAttribution(null),
      snapshot: null,
    };
  }

  const weather = toLegacyWeatherPayload(input.forecast);
  const conditionCode =
    weather?.current?.weather_code ?? weather?.daily?.weather_code?.[0] ?? null;

  const summary = formatWeatherSummary({
    city: input.city,
    currentC: weather?.current?.temperature_2m ?? null,
    highC: weather?.daily?.temperature_2m_max?.[0] ?? null,
    lowC: weather?.daily?.temperature_2m_min?.[0] ?? null,
    unit: input.unit,
    conditionCode,
  });

  const snapshot = buildWeatherSnapshot({
    forecast: input.forecast,
    unit: input.unit,
  });

  const intel = buildWeatherIntelligence(input.forecast, summary);
  const tag = composeHeroWeatherTag({
    editionDate: input.editionDate,
    userId: input.userId,
    highC: weather?.daily?.temperature_2m_max?.[0] ?? null,
    currentC: weather?.current?.temperature_2m ?? null,
    conditionCode,
    unit: input.unit,
  });

  return {
    summary,
    intel,
    tag,
    attribution: weatherSourceAttribution(input.forecast),
    snapshot,
  };
}
