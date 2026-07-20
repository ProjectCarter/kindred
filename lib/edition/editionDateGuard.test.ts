import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calendarEditionDate,
  isPastEditionDate,
  liveHomeEditionDate,
  todayInHistoryMonthDayFromEditionDate,
} from "./editionDateGuard.ts";

test("isPastEditionDate — yesterday is stale", () => {
  assert.equal(isPastEditionDate("2026-07-18", "2026-07-19"), true);
  assert.equal(isPastEditionDate("2026-07-19", "2026-07-19"), false);
  assert.equal(isPastEditionDate("2026-07-20", "2026-07-19"), false);
});

test("liveHomeEditionDate — never keys home load before calendar today", () => {
  assert.equal(liveHomeEditionDate("2026-07-18", "2026-07-19"), "2026-07-19");
  assert.equal(liveHomeEditionDate("2026-07-19", "2026-07-19"), "2026-07-19");
  assert.equal(liveHomeEditionDate("2026-07-20", "2026-07-19"), "2026-07-20");
});

test("todayInHistoryMonthDayFromEditionDate", () => {
  assert.equal(
    todayInHistoryMonthDayFromEditionDate("2026-07-19"),
    "07-19"
  );
});

test("calendarEditionDate — local YYYY-MM-DD shape", () => {
  const d = calendarEditionDate(new Date(2026, 6, 19, 12, 0, 0));
  assert.match(d, /^\d{4}-\d{2}-\d{2}$/);
});
