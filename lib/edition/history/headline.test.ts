import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveEditorialHeadlineFromEvent,
  formatTodayInHistoryHeadline,
  resolveTodayInHistoryDisplayHeadline,
} from "./headline.ts";

const AVIATION_EVENT =
  "The Aviation Section, U.S. Signal Corps, is created as the country's first military aviation unit.";

test("Aviation Section headline is complete and newspaper-quality", () => {
  const headline = formatTodayInHistoryHeadline(1914, AVIATION_EVENT);
  assert.equal(headline, "1914 — The U.S. Army Creates the Aviation Section");
  assert.doesNotMatch(headline, /\.\.\./);
  assert.doesNotMatch(headline, /The U\.\.\./);
});

test("deriveEditorialHeadlineFromEvent never hard-truncates with word slices", () => {
  const headline = deriveEditorialHeadlineFromEvent(
    "The United States Congress forms the Aviation Section, U.S. Signal Corps, which absorbed and replaced the Aeronautical Division."
  );
  assert.match(headline, /Aviation Section/i);
  assert.doesNotMatch(headline, /\.\.\./);
  assert.ok(headline.split(/\s+/).length >= 6);
});

test("formatTodayInHistoryHeadline normalizes year prefix", () => {
  assert.equal(
    formatTodayInHistoryHeadline(
      1969,
      "Apollo 11 lands on the Moon.",
      "1969 - Humanity Walks on the Moon"
    ),
    "1969 — Humanity Walks on the Moon"
  );
});

test("resolveTodayInHistoryDisplayHeadline repairs truncated stored headlines", () => {
  const display = resolveTodayInHistoryDisplayHeadline({
    headline: "1914 — The U",
    body: "In 1914, the Aviation Section, U.S. Signal Corps, is created as the country's first military aviation unit. Context follows.",
  });
  assert.equal(display, "1914 — The U.S. Army Creates the Aviation Section");
});

test("formatTodayInHistoryHeadline derives from event when generic", () => {
  const headline = formatTodayInHistoryHeadline(
    1903,
    "The Wright brothers make the first powered flight at Kitty Hawk.",
    "Today in History"
  );
  assert.equal(headline.startsWith("1903 — "), true);
  assert.equal(headline.includes("Today in History"), false);
  assert.match(headline, /Wright Brothers/i);
});
