import test from "node:test";
import assert from "node:assert/strict";
import {
  EDITION_WEATHER_MAX_AGE_MS,
  isWeatherStale,
  weatherAgeMs,
} from "./weatherFreshness.ts";

test("isWeatherStale rejects observations older than one hour", () => {
  const staleAt = new Date(Date.now() - EDITION_WEATHER_MAX_AGE_MS - 1_000).toISOString();
  assert.equal(isWeatherStale(staleAt), true);
});

test("isWeatherStale accepts fresh observations", () => {
  const freshAt = new Date(Date.now() - 5 * 60_000).toISOString();
  assert.equal(isWeatherStale(freshAt), false);
});

test("weatherAgeMs returns elapsed milliseconds", () => {
  const now = Date.parse("2026-07-21T18:00:00.000Z");
  const retrievedAt = "2026-07-21T17:30:00.000Z";
  assert.equal(weatherAgeMs(retrievedAt, now), 30 * 60_000);
});
