import test from "node:test";
import assert from "node:assert/strict";
import { resolveHomepageWeatherDisplay, createUnavailableWeatherDisplay } from "./homepageWeatherDisplay.ts";
import {
  isLiveWeatherFresh,
  liveWeatherToSnapshot,
  liveWeatherRequestKey,
  parseLiveWeatherResponse,
  shouldRefreshLiveWeather,
} from "./liveWeatherTypes.ts";

const editionSnapshot83Cloudy = {
  retrievedAt: new Date().toISOString(),
  conditionCode: 3,
  currentTempC: 28.3,
  highTempC: 31.1,
  lowTempC: 22.2,
  windSpeedMs: 3,
  unit: "fahrenheit" as const,
  alerts: [],
  guidanceNote: null,
};

function liveWeather97Sunny() {
  const fetchedAt = new Date().toISOString();
  return {
    observedAt: fetchedAt,
    fetchedAt,
    expiresAt: new Date(Date.now() + 12 * 60 * 1000).toISOString(),
    provider: "open_meteo",
    latitude: 33.3528,
    longitude: -111.789,
    metroKey: "gilbert-az",
    city: "Gilbert",
    unit: "fahrenheit" as const,
    conditionCode: 0,
    currentTempC: 36.1,
    highTempC: 40.6,
    lowTempC: 30.0,
    windSpeedMs: 3,
    alerts: [],
    guidanceNote:
      "Expect sunshine throughout the day with warm afternoon temperatures.",
  };
}

test("live weather 97° Sunny replaces edition snapshot 83° Cloudy", () => {
  const live = liveWeather97Sunny();
  const display = resolveHomepageWeatherDisplay({
    weatherSnapshot: editionSnapshot83Cloudy,
    liveWeather: live,
    liveWeatherSource: "live",
  });

  assert.ok(display);
  assert.equal(display.current, "97°");
  assert.equal(display.condition.label, "Sunny");
  assert.equal(display.dataSource, "live");
  assert.equal(display.isEditionFallback, false);
});

test("edition snapshot never overwrites fresh live weather", () => {
  const live = liveWeather97Sunny();
  const display = resolveHomepageWeatherDisplay({
    editorialContext: {
      weatherSummary:
        "Current 83°F in Gilbert; high 88°F / low 72°F; cloudy skies.",
      weatherSnapshot: editionSnapshot83Cloudy,
    },
    weatherSnapshot: editionSnapshot83Cloudy,
    liveWeather: live,
    liveWeatherSource: "server-cache",
  });

  assert.equal(display?.current, "97°");
  assert.equal(display?.condition.label, "Sunny");
  assert.equal(display?.dataSource, "server-cache");
});

test("edition snapshot is fallback when live weather is unavailable", () => {
  const display = resolveHomepageWeatherDisplay({
    weatherSnapshot: editionSnapshot83Cloudy,
    liveWeather: null,
  });

  assert.ok(display);
  assert.equal(display.current, "83°");
  assert.equal(display.condition.label, "Cloudy");
  assert.equal(display.dataSource, "edition-fallback");
  assert.equal(display.isEditionFallback, true);
});

test("summary text alone shows unavailable placeholder", () => {
  const display = resolveHomepageWeatherDisplay({
    editorialContext: {
      weatherSummary:
        "Current 102°F in Gilbert; high 106°F / low 84°F; partly cloudy skies.",
    },
  });

  assert.equal(display.isUnavailable, true);
});

test("stale edition snapshot remains visible as fallback without live weather", () => {
  const display = resolveHomepageWeatherDisplay({
    weatherSnapshot: {
      ...editionSnapshot83Cloudy,
      retrievedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    },
  });

  assert.ok(display);
  assert.equal(display.current, "83°");
  assert.equal(display.dataSource, "edition-fallback");
  assert.equal(display.fallbackReason, "edition_snapshot_stale");
});

test("no weather data shows minimal unavailable line", () => {
  const display = resolveHomepageWeatherDisplay({});
  assert.equal(display.isUnavailable, true);
  assert.match(display.condition.label, /Weather unavailable/i);
  assert.equal(createUnavailableWeatherDisplay().fallbackReason, "no_weather_data");
});

test("expired live weather falls back to edition snapshot when available", () => {
  const expiredLive = {
    ...liveWeather97Sunny(),
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
  };
  const display = resolveHomepageWeatherDisplay({
    weatherSnapshot: editionSnapshot83Cloudy,
    liveWeather: expiredLive,
  });

  assert.ok(display);
  assert.equal(display.current, "83°");
  assert.equal(display.dataSource, "edition-fallback");
  assert.equal(display.isUnavailable, undefined);
});

test("live request fails — edition snapshot remains visible", () => {
  const display = resolveHomepageWeatherDisplay({
    weatherSnapshot: editionSnapshot83Cloudy,
    liveWeather: null,
  });

  assert.equal(display.isUnavailable, undefined);
  assert.equal(display.current, "83°");
  assert.match(display.highLow ?? "", /High/i);
  assert.ok(display.condition.label);
  assert.ok(display.condition.emoji);
});

test("edition snapshot renders before live weather arrives", () => {
  const editionOnly = resolveHomepageWeatherDisplay({
    weatherSnapshot: editionSnapshot83Cloudy,
    liveWeather: null,
  });
  assert.equal(editionOnly.current, "83°");
  assert.equal(editionOnly.dataSource, "edition-fallback");

  const live = {
    ...liveWeather97Sunny(),
    emoji: "☀️",
    conditionLabel: "Sunny",
    canonicalCondition: "clear" as const,
  };
  const withLive = resolveHomepageWeatherDisplay({
    weatherSnapshot: editionSnapshot83Cloudy,
    liveWeather: live,
    liveWeatherSource: "live",
  });

  assert.equal(withLive.current, "97°");
  assert.equal(withLive.condition.label, "Sunny");
  assert.equal(withLive.dataSource, "live");
  assert.equal(withLive.isUnavailable, undefined);
});

test("live condition uses server emoji and label without canonicalCondition", () => {
  const live = {
    ...liveWeather97Sunny(),
    emoji: "⛅",
    conditionLabel: "Mostly Cloudy",
    canonicalCondition: null,
    conditionCode: 2,
  };
  const display = resolveHomepageWeatherDisplay({
    weatherSnapshot: editionSnapshot83Cloudy,
    liveWeather: live,
    liveWeatherSource: "live",
  });

  assert.equal(display.condition.label, "Mostly Cloudy");
  assert.equal(display.condition.emoji, "⛅");
});

test("unknown live condition code still renders with safe fallback", () => {
  const live = {
    ...liveWeather97Sunny(),
    conditionCode: 9999,
    emoji: null,
    conditionLabel: null,
    canonicalCondition: null,
  };
  const display = resolveHomepageWeatherDisplay({
    liveWeather: live,
    liveWeatherSource: "live",
  });

  assert.equal(display.isUnavailable, undefined);
  assert.equal(display.current, "97°");
  assert.ok(display.condition.label);
  assert.ok(display.condition.emoji);
});

test("isLiveWeatherFresh respects expiresAt", () => {
  const fresh = liveWeather97Sunny();
  assert.equal(isLiveWeatherFresh(fresh), true);

  const stale = {
    ...fresh,
    expiresAt: new Date(Date.now() - 1_000).toISOString(),
  };
  assert.equal(isLiveWeatherFresh(stale), false);
});

test("shouldRefreshLiveWeather triggers when missing or expired", () => {
  assert.equal(shouldRefreshLiveWeather(null), true);
  const fresh = liveWeather97Sunny();
  assert.equal(shouldRefreshLiveWeather(fresh), false);
  assert.equal(
    shouldRefreshLiveWeather({
      ...fresh,
      expiresAt: new Date(Date.now() - 1_000).toISOString(),
    }),
    true
  );
});

test("liveWeatherRequestKey isolates metros and coordinates", () => {
  const gilbert = liveWeatherRequestKey("gilbert-az", 33.3528, -111.789);
  const seattle = liveWeatherRequestKey("seattle-wa", 47.6062, -122.3321);
  assert.notEqual(gilbert, seattle);
});

test("parseLiveWeatherResponse validates required fields", () => {
  const live = liveWeather97Sunny();
  assert.ok(parseLiveWeatherResponse(live));
  assert.equal(parseLiveWeatherResponse({ ...live, currentTempC: "bad" }), null);
});

test("liveWeatherToSnapshot maps observation fields for guidance", () => {
  const live = liveWeather97Sunny();
  const snapshot = liveWeatherToSnapshot(live);
  assert.equal(snapshot.currentTempC, 36.1);
  assert.equal(snapshot.conditionCode, 0);
  assert.equal(snapshot.retrievedAt, live.observedAt);
});

test("resolveHomepageWeatherDisplay shows compact alert from live weather", () => {
  const live = {
    ...liveWeather97Sunny(),
    alerts: [
      {
        event: "Extreme Heat Warning",
        start: Math.floor(Date.now() / 1000) - 3600,
        end: Math.floor(Date.now() / 1000) + 3600,
      },
    ],
  };
  const display = resolveHomepageWeatherDisplay({
    liveWeather: live,
    liveWeatherSource: "live",
  });

  assert.ok(display?.alert);
  assert.match(display.alert?.label ?? "", /Extreme Heat Warning/i);
});
