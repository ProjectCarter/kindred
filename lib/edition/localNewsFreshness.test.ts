/**
 * Local News freshness helpers — Node smoke tests.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  LOCAL_NEWS_FETCH_WINDOW_DAYS,
  LOCAL_NEWS_MAX_LEAD_AGE_DAYS,
  LOCAL_NEWS_PREFERRED_MAX_HOURS,
  hoursSincePublished,
  isPressReleaseWire,
  localLeadAgeBand,
  localNewsFetchFromDate,
} from "./localNewsFreshness.ts";

const NOW = new Date("2026-07-18T15:00:00.000Z");

function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 3_600_000).toISOString();
}

test("fetch window is seven days", () => {
  assert.equal(LOCAL_NEWS_FETCH_WINDOW_DAYS, 7);
  assert.equal(localNewsFetchFromDate(NOW), "2026-07-11");
});

test("preferred band is twenty-four hours", () => {
  assert.equal(LOCAL_NEWS_PREFERRED_MAX_HOURS, 24);
  assert.equal(localLeadAgeBand(hoursAgo(24), NOW), "preferred");
  assert.equal(localLeadAgeBand(hoursAgo(25), NOW), "within_week");
  assert.equal(
    localLeadAgeBand(hoursAgo(LOCAL_NEWS_MAX_LEAD_AGE_DAYS * 24 + 1), NOW),
    "stale"
  );
  assert.equal(hoursSincePublished(hoursAgo(10), NOW)?.toFixed(0), "10");
});

test("press release wires are detected", () => {
  assert.equal(
    isPressReleaseWire({
      source: "PRNewswire",
      url: "https://www.prnewswire.com/news-releases/example.html",
    }),
    true
  );
  assert.equal(
    isPressReleaseWire({
      source: "East Valley Tribune",
      url: "https://www.eastvalleytribune.com/local/story",
    }),
    false
  );
});
