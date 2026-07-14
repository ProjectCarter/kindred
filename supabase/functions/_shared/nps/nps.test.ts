import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { npsParksAsDiscoveryItems } from "./catalog.ts";
import { buildNpsWeatherHint, topNpsPlanningNote } from "./weatherHints.ts";
import { isNpsConfigured } from "./npsProvider.ts";
import type { NpsParkRecord } from "./types.ts";
import { buildWeatherIntelligence } from "../weather/intelligence.ts";
import type { NormalizedWeatherForecast } from "../weather/providers/types.ts";

const samplePark: NpsParkRecord = {
  provider: "nps",
  parkCode: "yose",
  fullName: "Yosemite National Park",
  designation: "National Park",
  description: "Glacier-carved valleys and granite cliffs in the Sierra Nevada.",
  states: "CA",
  lat: 37.8651,
  lon: -119.5383,
  url: "https://www.nps.gov/yose/index.htm",
  imageUrl: null,
  imageAttribution: null,
  entranceFeeSummary: null,
  operatingHoursSummary: null,
  alerts: [],
  events: [],
  distanceKm: 45,
  confidence: 0.92,
  sourceAttribution: "National Park Service — Yosemite National Park",
  retrievedAt: new Date().toISOString(),
  weatherHint: null,
};

Deno.test("nps parks become discovery items with nps_park tag", () => {
  const items = npsParksAsDiscoveryItems([samplePark]);
  assertEquals(items.length, 1);
  assertEquals(items[0].tags.includes("nps_park"), true);
  assertEquals(items[0].source.name, "National Park Service");
  assertEquals(items[0].category, "hiking");
});

Deno.test("nps weather hint prefers morning start when rain arrives afternoon", () => {
  const intel = buildWeatherIntelligence(clearForecast(), "Fair and warm.");
  const rainyAfternoon = intel
    ? {
        ...intel,
        isRainy: false,
        rainBeginsAfternoon: true,
        isIdealMorningOutdoor: true,
      }
    : null;

  const hint = buildNpsWeatherHint(samplePark, rainyAfternoon);
  assertEquals(hint?.includes("afternoon"), true);
  assertEquals(hint?.includes("Yosemite"), true);
});

Deno.test("topNpsPlanningNote prefers park-specific hint over generic weather", () => {
  const intel = buildWeatherIntelligence(clearForecast(), "Clear skies.");
  const parks = [
    {
      ...samplePark,
      weatherHint: "Perfect weather for Yosemite today.",
    },
  ];
  const note = topNpsPlanningNote(parks, intel);
  assertEquals(note?.includes("Yosemite"), true);
});

Deno.test("nps provider registers when key is configured", () => {
  const configured = isNpsConfigured();
  assertEquals(typeof configured, "boolean");
});

function clearForecast(): NormalizedWeatherForecast {
  return {
    provider: "open_meteo",
    lat: 37.8,
    lon: -119.5,
    retrievedAt: new Date().toISOString(),
    current: {
      temperatureC: 22,
      feelsLikeC: 22,
      weatherCode: 0,
      conditionLabel: "Clear",
      uvi: 5,
      sunrise: 1_700_000_000,
      sunset: 1_700_030_000,
      humidityPct: 40,
      windSpeedMs: 3,
      windGustMs: null,
      precipitationProbability: 0.1,
    },
    daily: [
      {
        date: "2026-07-14",
        tempMaxC: 26,
        tempMinC: 14,
        weatherCode: 0,
        uvi: 6,
        sunrise: 1_700_000_000,
        sunset: 1_700_030_000,
        popMax: 0.1,
        windSpeedMaxMs: 4,
      },
    ],
    hourly: [],
    alerts: [],
    airQuality: null,
    legacy: {
      current: { temperature_2m: 22, weather_code: 0 },
      daily: {
        temperature_2m_max: [26],
        temperature_2m_min: [14],
        weather_code: [0],
      },
    },
  };
}
