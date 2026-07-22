import test from "node:test";
import assert from "node:assert/strict";
import {
  localNewsBriefingMinWords,
  nationalNewsBriefingMinWords,
  newsBriefingWordCount,
} from "./newsBriefingQuality.ts";

test("newsBriefingWordCount counts lead and desk sections together", () => {
  const words = newsBriefingWordCount([
    "City leaders approved the bond measure after months of debate.",
    "The vote keeps parks funding steady while delaying a road project.",
    "Residents focused on drainage repairs in older neighborhoods.",
  ]);
  assert.ok(words >= 20);
});

test("localNewsBriefingMinWords scales with source richness", () => {
  const rich = "word ".repeat(90).trim();
  const medium = "word ".repeat(50).trim();
  const thin = "word ".repeat(20).trim();
  assert.ok(localNewsBriefingMinWords(rich) > localNewsBriefingMinWords(medium));
  assert.ok(localNewsBriefingMinWords(medium) > localNewsBriefingMinWords(thin));
});

test("nationalNewsBriefingMinWords stays below local gate for same source", () => {
  const source = "word ".repeat(90).trim();
  assert.ok(nationalNewsBriefingMinWords(source) < localNewsBriefingMinWords(source));
});
