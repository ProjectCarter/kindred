import test from "node:test";
import assert from "node:assert/strict";
import {
  formatTodayInHistoryHeadline,
  resolveTodayInHistoryDisplayHeadline,
} from "./history/headline.ts";
import { detectEditorialRedundancy } from "./editorialRedundancy.ts";

test("Apollo stored headline is editorialized instead of repeating event text", () => {
  const eventText =
    "At 02:56 UTC, astronaut Neil Armstrong becomes the first person to walk on the Moon";
  const headline = formatTodayInHistoryHeadline(
    1969,
    eventText,
    `1969 — ${eventText}`
  );
  assert.equal(headline, "1969 — Apollo 11 Lands on the Moon");
});

test("Apollo raw stored headline and body opener fail redundancy gate", () => {
  const eventText =
    "At 02:56 UTC, astronaut Neil Armstrong becomes the first person to walk on the Moon";
  const headline = `1969 — ${eventText}`;
  const bodyOpener = `In 1969, ${eventText.charAt(0).toLowerCase()}${eventText.slice(1).replace(/\.$/, "")}.`;
  const result = detectEditorialRedundancy({
    headline,
    paragraphs: [
      bodyOpener,
      "Mission control had spent years preparing for a moment that still felt improbable until the engines cut off.",
    ],
  });
  assert.equal(result.passes, false);
});

test("resolveTodayInHistoryDisplayHeadline repairs cached Apollo headline", () => {
  const eventText =
    "At 02:56 UTC, astronaut Neil Armstrong becomes the first person to walk on the Moon";
  const body = [
    `In 1969, ${eventText.charAt(0).toLowerCase()}${eventText.slice(1).replace(/\.$/, "")}.`,
    "Mission control had spent years preparing for a moment that still felt improbable until the engines cut off.",
  ].join("\n\n");
  const headline = resolveTodayInHistoryDisplayHeadline({
    headline: `1969 — ${eventText}`,
    body,
  });
  assert.equal(headline, "1969 — Apollo 11 Lands on the Moon");
});
