import test from "node:test";
import assert from "node:assert/strict";
import {
  detectEditorialRedundancy,
  detectDuplicateSentences,
  proseNearDuplicate,
} from "./editorialRedundancy.ts";

test("proseNearDuplicate catches lightly rephrased repeats", () => {
  const a =
    "Neil Armstrong becomes the first person to walk on the Moon during the Apollo 11 mission.";
  const b =
    "Neil Armstrong becomes the first person to walk on the Moon during Apollo 11.";
  assert.equal(proseNearDuplicate(a, b), true);
});

test("detectEditorialRedundancy rejects repeated paragraphs", () => {
  const paragraph =
    "Neil Armstrong becomes the first person to walk on the Moon during the Apollo 11 mission.";
  const result = detectEditorialRedundancy({
    headline: "1969 — One small step on the Moon",
    paragraphs: [paragraph, paragraph],
  });
  assert.equal(result.passes, false);
  assert.ok(result.reasons.some((r) => r.includes("repeats_paragraph")));
});

test("detectDuplicateSentences flags repeated sentences across paragraphs", () => {
  const duplicates = detectDuplicateSentences([
    "Armstrong stepped onto the lunar surface at 10:56 p.m. Eastern time.",
    "The world watched live as Armstrong stepped onto the lunar surface at 10:56 p.m. Eastern time.",
  ]);
  assert.equal(duplicates.length, 1);
});

test("detectEditorialRedundancy accepts distinct progression", () => {
  const result = detectEditorialRedundancy({
    headline: "1969 — One small step on the Moon",
    dek: "The landing rewrote what humanity thought possible in space.",
    paragraphs: [
      "Armstrong and Aldrin landed the lunar module on the Moon on July 20, 1969.",
      "Mission control had spent years preparing for a moment that still felt improbable until the engines cut off.",
      "The broadcast reached living rooms worldwide, turning a technical achievement into a shared civic memory.",
      "Within years, the flight reshaped budgets, diplomacy, and the pace of engineering education.",
      "Half a century later, the boot prints remain the reference point for every new lunar ambition.",
    ],
  });
  assert.equal(result.passes, true);
});
