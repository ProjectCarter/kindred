import test from "node:test";
import assert from "node:assert/strict";
import {
  cacheEditionDateForPolicy,
  computeRefreshAfter,
  isMetroSectionCacheValid,
  isSectionForceRefreshRequested,
  mostRecentSundayUtc,
  nextSundayUtc,
  SECTION_FRESHNESS_POLICIES,
  weeklySundayPeriodKey,
} from "./sectionFreshness.ts";

test("weekly Sunday period key lands on Sunday UTC", () => {
  const wednesday = new Date("2026-07-22T15:00:00.000Z");
  assert.equal(weeklySundayPeriodKey(wednesday), "2026-07-19");
  assert.equal(mostRecentSundayUtc(wednesday).getUTCDay(), 0);
});

test("computeRefreshAfter daily expires next calendar day", () => {
  const generatedAt = new Date("2026-07-23T12:00:00.000Z");
  const refreshAfter = computeRefreshAfter(
    SECTION_FRESHNESS_POLICIES.local_events,
    generatedAt,
    "2026-07-23"
  );
  assert.equal(refreshAfter.toISOString(), "2026-07-24T00:00:00.000Z");
});

test("computeRefreshAfter weekly Sunday expires next Sunday", () => {
  const generatedAt = new Date("2026-07-23T12:00:00.000Z");
  const refreshAfter = computeRefreshAfter(
    SECTION_FRESHNESS_POLICIES.activities,
    generatedAt,
    "2026-07-23"
  );
  assert.equal(refreshAfter.toISOString(), nextSundayUtc(generatedAt).toISOString());
});

test("isMetroSectionCacheValid rejects expired rows", () => {
  const now = new Date("2026-07-24T01:00:00.000Z");
  assert.equal(
    isMetroSectionCacheValid(
      {
        generated_at: "2026-07-23T08:00:00.000Z",
        refresh_after: "2026-07-24T00:00:00.000Z",
        generation_status: "complete",
        validation_status: "valid",
        content_version: 1,
      },
      now
    ),
    false
  );
});

test("isSectionForceRefreshRequested honors all alias", () => {
  assert.equal(isSectionForceRefreshRequested("local_events", ["all"]), true);
  assert.equal(isSectionForceRefreshRequested("local_events", ["food_drinks"]), false);
});

test("cacheEditionDateForPolicy uses evergreen key for story_of", () => {
  assert.equal(
    cacheEditionDateForPolicy(SECTION_FRESHNESS_POLICIES.story_of, "2026-07-23"),
    "evergreen"
  );
});
