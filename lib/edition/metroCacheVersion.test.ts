import test from "node:test";
import assert from "node:assert/strict";
import {
  KINDRED_METRO_CACHE_VERSION,
  isMetroCacheVersionCurrent,
} from "./metroCacheVersion.ts";
import { isMetroSectionCacheValid } from "./sectionFreshness.ts";

test("KINDRED_METRO_CACHE_VERSION is manually controlled integer", () => {
  assert.equal(typeof KINDRED_METRO_CACHE_VERSION, "number");
  assert.ok(KINDRED_METRO_CACHE_VERSION >= 1);
});

test("isMetroCacheVersionCurrent matches exact version only", () => {
  assert.equal(isMetroCacheVersionCurrent(KINDRED_METRO_CACHE_VERSION), true);
  assert.equal(isMetroCacheVersionCurrent(KINDRED_METRO_CACHE_VERSION - 1), false);
  assert.equal(isMetroCacheVersionCurrent(KINDRED_METRO_CACHE_VERSION + 1), false);
});

test("isMetroSectionCacheValid rejects stale cache_version", () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  assert.equal(
    isMetroSectionCacheValid(
      {
        generated_at: new Date().toISOString(),
        refresh_after: future,
        generation_status: "complete",
        validation_status: "valid",
        content_version: KINDRED_METRO_CACHE_VERSION - 1,
      },
      new Date()
    ),
    false
  );
});

test("isMetroSectionCacheValid accepts current cache_version", () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  assert.equal(
    isMetroSectionCacheValid(
      {
        generated_at: new Date().toISOString(),
        refresh_after: future,
        generation_status: "complete",
        validation_status: "valid",
        content_version: KINDRED_METRO_CACHE_VERSION,
      },
      new Date()
    ),
    true
  );
});
