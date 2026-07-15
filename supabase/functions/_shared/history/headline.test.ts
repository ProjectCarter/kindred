import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { formatTodayInHistoryHeadline } from "./headline.ts";

Deno.test("formatTodayInHistoryHeadline normalizes year prefix", () => {
  assertEquals(
    formatTodayInHistoryHeadline(
      1969,
      "Apollo 11 lands on the Moon.",
      "1969 - Humanity Walks on the Moon"
    ),
    "1969 — Humanity Walks on the Moon"
  );
});

Deno.test("formatTodayInHistoryHeadline adds year to editorial title", () => {
  assertEquals(
    formatTodayInHistoryHeadline(
      1889,
      "The Eiffel Tower opens in Paris.",
      "The Eiffel Tower Opens"
    ),
    "1889 — The Eiffel Tower Opens"
  );
});

Deno.test("formatTodayInHistoryHeadline derives from event when generic", () => {
  const headline = formatTodayInHistoryHeadline(
    1903,
    "The Wright brothers make the first powered flight at Kitty Hawk.",
    "Today in History"
  );
  assertEquals(headline.startsWith("1903 — "), true);
  assertEquals(headline.includes("Today in History"), false);
});
