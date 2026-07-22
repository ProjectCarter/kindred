import test from "node:test";
import assert from "node:assert/strict";
import { resolveOpenWeatherCanonicalCondition } from "./canonicalCondition.ts";
import { weatherConditionFromWmoCode } from "./weatherEmojiGuide.ts";
import { liveWeatherConditionDisplay } from "./liveWeatherTypes.ts";
import { resolveHomepageWeatherDisplay } from "./homepageWeatherDisplay.ts";

function resolve(input: {
  id: number;
  main?: string;
  description?: string;
  clouds?: number | null;
  isDaytime?: boolean;
  windSpeedMs?: number | null;
}) {
  return resolveOpenWeatherCanonicalCondition({
    providerConditionId: input.id,
    providerMain: input.main ?? null,
    providerDescription: input.description ?? null,
    cloudPercentage: input.clouds ?? null,
    isDaytime: input.isDaytime ?? true,
    windSpeedMs: input.windSpeedMs ?? null,
  });
}

test("800 clear sky → Sunny + ☀️", () => {
  const result = resolve({ id: 800, main: "Clear", description: "clear sky" });
  assert.equal(result.canonicalCondition, "clear");
  assert.equal(result.label, "Sunny");
  assert.equal(result.emoji, "☀️");
});

test("801 few clouds → Mostly Sunny + 🌤️", () => {
  const result = resolve({
    id: 801,
    main: "Clouds",
    description: "few clouds",
    clouds: 12,
  });
  assert.equal(result.canonicalCondition, "mostly_clear");
  assert.equal(result.label, "Mostly Sunny");
  assert.equal(result.emoji, "🌤️");
});

test("802 scattered clouds → Partly Cloudy + 🌤️", () => {
  const result = resolve({
    id: 802,
    main: "Clouds",
    description: "scattered clouds",
    clouds: 35,
  });
  assert.equal(result.canonicalCondition, "partly_cloudy");
  assert.equal(result.label, "Partly Cloudy");
  assert.equal(result.emoji, "🌤️");
});

test("803 broken clouds → Mostly Cloudy + ⛅", () => {
  const result = resolve({
    id: 803,
    main: "Clouds",
    description: "broken clouds",
    clouds: 65,
  });
  assert.equal(result.canonicalCondition, "mostly_cloudy");
  assert.equal(result.label, "Mostly Cloudy");
  assert.equal(result.emoji, "⛅");
});

test("804 overcast clouds → Cloudy + ☁️", () => {
  const result = resolve({
    id: 804,
    main: "Clouds",
    description: "overcast clouds",
    clouds: 92,
  });
  assert.equal(result.canonicalCondition, "cloudy");
  assert.equal(result.label, "Cloudy");
  assert.equal(result.emoji, "☁️");
});

test("rain maps to rain emoji", () => {
  const result = resolve({
    id: 501,
    main: "Rain",
    description: "moderate rain",
  });
  assert.equal(result.canonicalCondition, "rain");
  assert.equal(result.emoji, "🌧️");
});

test("thunderstorms map to storm emoji", () => {
  const result = resolve({
    id: 200,
    main: "Thunderstorm",
    description: "thunderstorm with light rain",
  });
  assert.equal(result.canonicalCondition, "thunderstorms");
  assert.equal(result.emoji, "⛈️");
});

test("fog maps to fog emoji", () => {
  const result = resolve({ id: 741, main: "Fog", description: "fog" });
  assert.equal(result.canonicalCondition, "fog");
  assert.equal(result.emoji, "🌫️");
});

test("nighttime clear uses moon emoji", () => {
  const result = resolve({
    id: 800,
    main: "Clear",
    description: "clear sky",
    isDaytime: false,
  });
  assert.equal(result.canonicalCondition, "clear");
  assert.equal(result.emoji, "🌙");
});

test("nighttime partly cloudy uses night emoji", () => {
  const result = resolve({
    id: 802,
    main: "Clouds",
    description: "scattered clouds",
    isDaytime: false,
  });
  assert.equal(result.canonicalCondition, "partly_cloudy");
  assert.equal(result.emoji, "☁️");
});

test("regression: internal WMO 3 alone must not become Cloudy without provider context", () => {
  const fromWmo = weatherConditionFromWmoCode(3);
  assert.equal(fromWmo?.label, "Cloudy");

  const fromProvider = resolve({
    id: 801,
    main: "Clouds",
    description: "few clouds",
    clouds: 8,
  });
  assert.notEqual(fromProvider.canonicalCondition, "cloudy");
  assert.equal(fromProvider.label, "Mostly Sunny");
});

test("homepage uses live canonical condition over stale edition WMO 3", () => {
  const staleSnapshot = {
    retrievedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    conditionCode: 3,
    currentTempC: 28.3,
    highTempC: 40,
    lowTempC: 22,
    windSpeedMs: 3,
    unit: "fahrenheit" as const,
    alerts: [],
    guidanceNote: null,
  };
  const live = {
    observedAt: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 12 * 60 * 1000).toISOString(),
    provider: "openweather",
    latitude: 33.2748,
    longitude: -111.7769,
    metroKey: "gilbert-az",
    city: "Gilbert",
    unit: "fahrenheit" as const,
    conditionCode: 1,
    currentTempC: 36.7,
    highTempC: 40.6,
    lowTempC: 28.9,
    windSpeedMs: 3,
    alerts: [],
    guidanceNote: null,
    canonicalCondition: "mostly_clear" as const,
    providerConditionId: 801,
    providerMain: "Clouds",
    providerDescription: "few clouds",
    cloudPercentage: 12,
    isDaytime: true,
    emoji: "🌤️",
    conditionLabel: "Mostly Sunny",
    mappingSource: "openweather_id",
    rawInternalCode: 1,
  };

  const display = resolveHomepageWeatherDisplay({
    weatherSnapshot: staleSnapshot,
    liveWeather: live,
    liveWeatherSource: "live",
  });

  assert.equal(display.condition.label, "Mostly Sunny");
  assert.equal(display.condition.emoji, "🌤️");
  assert.equal(display.current, "98°");
  assert.equal(display.dataSource, "live");
});

test("liveWeatherConditionDisplay prefers server emoji and label", () => {
  const condition = liveWeatherConditionDisplay({
    observedAt: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 12 * 60 * 1000).toISOString(),
    provider: "openweather",
    latitude: 33.27,
    longitude: -111.77,
    metroKey: "gilbert-az",
    city: "Gilbert",
    unit: "fahrenheit",
    conditionCode: 3,
    currentTempC: 36,
    highTempC: 40,
    lowTempC: 28,
    windSpeedMs: 2,
    alerts: [],
    guidanceNote: null,
    canonicalCondition: "clear",
    providerConditionId: 800,
    providerMain: "Clear",
    providerDescription: "clear sky",
    cloudPercentage: 5,
    isDaytime: true,
    emoji: "☀️",
    conditionLabel: "Sunny",
    mappingSource: "openweather_id",
    rawInternalCode: 0,
  });

  assert.equal(condition?.label, "Sunny");
  assert.equal(condition?.emoji, "☀️");
});
