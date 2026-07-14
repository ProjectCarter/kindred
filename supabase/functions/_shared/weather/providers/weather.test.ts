import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { openWeatherIdToWmo } from "./wmo.ts";
import { buildWeatherIntelligence } from "../intelligence.ts";
import { getWeatherProviders, isOpenWeatherConfigured } from "./index.ts";
import type { NormalizedWeatherForecast } from "./types.ts";

Deno.test("openweather id maps to WMO weather codes", () => {
  assertEquals(openWeatherIdToWmo(800), 0);
  assertEquals(openWeatherIdToWmo(500), 61);
  assertEquals(openWeatherIdToWmo(200), 95);
  assertEquals(openWeatherIdToWmo(600), 71);
});

Deno.test("weather intelligence prefers beaches on clear warm days", () => {
  const forecast: NormalizedWeatherForecast = {
    provider: "openweather",
    lat: 33.4,
    lon: -111.9,
    retrievedAt: new Date().toISOString(),
    current: {
      temperatureC: 28,
      feelsLikeC: 28,
      weatherCode: 0,
      conditionLabel: "Clear",
      uvi: 6,
      sunrise: 1_700_000_000,
      sunset: 1_700_030_000,
      humidityPct: 35,
      windSpeedMs: 2,
      windGustMs: null,
      precipitationProbability: 0.05,
    },
    daily: [
      {
        date: "2026-07-14",
        tempMaxC: 31,
        tempMinC: 22,
        weatherCode: 0,
        uvi: 7,
        sunrise: 1_700_000_000,
        sunset: 1_700_030_000,
        popMax: 0.05,
        windSpeedMaxMs: 3,
      },
    ],
    hourly: [],
    alerts: [],
    airQuality: null,
    legacy: {
      current: { temperature_2m: 28, weather_code: 0 },
      daily: {
        temperature_2m_max: [31],
        temperature_2m_min: [22],
        weather_code: [0],
      },
    },
  };

  const intel = buildWeatherIntelligence(
    forecast,
    "Current 82°F in Gilbert; high 88°F / low 72°F; plenty of sunshine."
  );
  assertEquals(intel?.isIdealBeachWeather, true);
  assertEquals(intel?.bucket, "fair");
});

Deno.test("weather intelligence prefers indoor on rainy days", () => {
  const forecast: NormalizedWeatherForecast = {
    provider: "openweather",
    lat: 40.7,
    lon: -74.0,
    retrievedAt: new Date().toISOString(),
    current: {
      temperatureC: 18,
      feelsLikeC: 17,
      weatherCode: 61,
      conditionLabel: "Rain",
      uvi: 2,
      sunrise: 1_700_000_000,
      sunset: 1_700_030_000,
      humidityPct: 90,
      windSpeedMs: 5,
      windGustMs: null,
      precipitationProbability: 0.8,
    },
    daily: [
      {
        date: "2026-07-14",
        tempMaxC: 19,
        tempMinC: 16,
        weatherCode: 61,
        uvi: 2,
        sunrise: 1_700_000_000,
        sunset: 1_700_030_000,
        popMax: 0.8,
        windSpeedMaxMs: 6,
      },
    ],
    hourly: [{ dt: 1_700_010_000, tempC: 18, feelsLikeC: 17, weatherCode: 61, pop: 0.8, humidityPct: 85, windSpeedMs: 4 }],
    alerts: [],
    airQuality: null,
    legacy: {
      current: { temperature_2m: 18, weather_code: 61 },
      daily: {
        temperature_2m_max: [19],
        temperature_2m_min: [16],
        weather_code: [61],
      },
    },
  };

  const intel = buildWeatherIntelligence(forecast, "Current 64°F; rain likely.");
  assertEquals(intel?.isIndoorPreferred, true);
  assertEquals(intel?.isRainy, true);
  assertEquals(intel?.planningNote?.includes("Rain"), true);
});

Deno.test("openweather provider registers when key is configured", () => {
  const configured = isOpenWeatherConfigured();
  const providers = getWeatherProviders();
  assertEquals(providers.some((p) => p.id === "open_meteo"), true);
  if (configured) {
    assertEquals(providers[0]?.id, "openweather");
  }
});
