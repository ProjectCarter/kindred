import test from "node:test";
import assert from "node:assert/strict";
import { resolveHomepageWeatherDisplay } from "./homepageWeatherDisplay.ts";

const freshSnapshot = {
  retrievedAt: new Date().toISOString(),
  conditionCode: 0,
  currentTempC: 36.1,
  highTempC: 40.6,
  lowTempC: 28.9,
  windSpeedMs: 3,
  unit: "fahrenheit" as const,
  alerts: [],
  guidanceNote: "Expect sunshine throughout the day with warm afternoon temperatures.",
};

test("resolveHomepageWeatherDisplay uses edition snapshot when no live weather", () => {
  const display = resolveHomepageWeatherDisplay({
    editorialContext: {
      weatherSummary:
        "Current 97°F in Gilbert; high 104°F / low 86°F; plenty of sunshine.",
      weatherSnapshot: freshSnapshot,
    },
    weatherSnapshot: freshSnapshot,
  });

  assert.ok(display);
  assert.equal(display.current, "97°");
  assert.equal(display.highLow, "High 105° · Low 84°");
  assert.equal(display.condition.label, "Sunny");
  assert.equal(display.condition.emoji, "☀️");
  assert.equal(display.dataSource, "edition-fallback");
});

test("resolveHomepageWeatherDisplay prefers fresh live weather over edition snapshot", () => {
  const staleSnapshot = {
    retrievedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    conditionCode: 3,
    currentTempC: 28.3,
    highTempC: 31.1,
    lowTempC: 22.2,
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
    conditionCode: 0,
    currentTempC: 36.7,
    highTempC: 40.6,
    lowTempC: 28.9,
    windSpeedMs: 3,
    alerts: [],
    guidanceNote: null,
    canonicalCondition: "clear" as const,
    providerConditionId: 800,
    providerMain: "Clear",
    providerDescription: "clear sky",
    cloudPercentage: 4,
    isDaytime: true,
    emoji: "☀️",
    conditionLabel: "Sunny",
    mappingSource: "openweather_id",
    rawInternalCode: 0,
  };

  const display = resolveHomepageWeatherDisplay({
    weatherSnapshot: staleSnapshot,
    liveWeather: live,
    liveWeatherSource: "live",
  });

  assert.equal(display.current, "98°");
  assert.equal(display.condition.label, "Sunny");
  assert.equal(display.condition.emoji, "☀️");
  assert.equal(display.dataSource, "live");
});

test("resolveHomepageWeatherDisplay rejects structurally invalid stale snapshot", () => {
  const display = resolveHomepageWeatherDisplay({
    editorialContext: {
      weatherSummary:
        "Current 91°F in Gilbert; high 93°F / low 80°F; overcast skies.",
      weatherSnapshot: {
        ...freshSnapshot,
        currentTempC: Number.NaN,
        retrievedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      },
    },
  });

  assert.equal(display.isUnavailable, true);
});

test("resolveHomepageWeatherDisplay never uses beat text as current fallback", () => {
  const display = resolveHomepageWeatherDisplay({
    morningWeatherBeat:
      "Expect a high near 106°F and a low near 84°F in Gilbert today, with plenty of sunshine.",
  });

  assert.equal(display.isUnavailable, true);
});

test("resolveHomepageWeatherDisplay shows compact alert", () => {
  const display = resolveHomepageWeatherDisplay({
    weatherSnapshot: {
      ...freshSnapshot,
      alerts: [
        {
          event: "Extreme Heat Warning",
          start: Math.floor(Date.now() / 1000) - 3600,
          end: Math.floor(Date.now() / 1000) + 3600,
        },
      ],
    },
  });

  assert.ok(display?.alert);
  assert.equal(display.alert?.emoji, "🔥");
  assert.match(display.alert?.label ?? "", /Extreme Heat Warning/i);
});
