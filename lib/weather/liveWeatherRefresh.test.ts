import test from "node:test";
import assert from "node:assert/strict";
import { isValidLiveWeatherSnapshot } from "./liveWeatherSnapshot.ts";

const SAMPLE = {
  weatherSummary: "Current 99°F in Gilbert; high 94°F / low 75°F; plenty of sunshine.",
  retrievedAt: new Date().toISOString(),
  fetchTimestamp: new Date().toISOString(),
  provider: "open_meteo",
  lat: 33.35,
  lon: -111.79,
  conditionCode: 0,
  currentC: 37.2,
  highC: 34.4,
  lowC: 23.9,
  cacheAgeMs: 0,
};

test("isValidLiveWeatherSnapshot accepts a fresh cached observation", () => {
  assert.equal(isValidLiveWeatherSnapshot(SAMPLE), true);
});

test("isValidLiveWeatherSnapshot rejects stale cached observations", () => {
  assert.equal(
    isValidLiveWeatherSnapshot({
      ...SAMPLE,
      retrievedAt: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
    }),
    false
  );
});

test("isValidLiveWeatherSnapshot rejects incomplete payloads", () => {
  assert.equal(isValidLiveWeatherSnapshot({ ...SAMPLE, weatherSummary: "" }), false);
  assert.equal(isValidLiveWeatherSnapshot(null), false);
});
