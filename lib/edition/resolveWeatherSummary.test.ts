import test from "node:test";
import assert from "node:assert/strict";
import {
  mergeWeatherSummaryIntoIntelligence,
  needsNetworkWeatherSummaryMerge,
  resolveWeatherSummary,
} from "./resolveWeatherSummary.ts";
import type { EditionIntelligence } from "./surfaceIntelligence.ts";

const baseIntel = (): EditionIntelligence => ({
  discovery: null,
  knowledge: null,
  memory: null,
  morning: null,
  morningOpening: null,
  morningBriefing: null,
  morningHero: null,
  banditAside: null,
  memoryNote: null,
  discoveryItems: [],
  discoveryHeadline: "Worth your time",
  discoveryEditorNote: null,
  leadWhyThisMatters: null,
  leadWhyChosen: null,
  leadContinuityKicker: null,
  banditsPick: null,
  historyAroundTown: null,
  weatherSummary: null,
  weatherSnapshot: null,
});

test("resolveWeatherSummary prefers network intelligence", () => {
  const summary = resolveWeatherSummary({
    intelligence: {
      ...baseIntel(),
      weatherSummary: "Current 91°F in Gilbert; high 93°F / low 80°F; overcast skies.",
    },
  });
  assert.equal(summary, "Current 91°F in Gilbert; high 93°F / low 80°F; overcast skies.");
});

test("needsNetworkWeatherSummaryMerge when cache lacks weather", () => {
  assert.equal(
    needsNetworkWeatherSummaryMerge({
      networkIntelligence: {
        ...baseIntel(),
        weatherSummary:
          "Current 91°F in Gilbert; high 93°F / low 80°F; overcast skies.",
      },
      onScreenIntelligence: baseIntel(),
    }),
    true
  );
});

test("mergeWeatherSummaryIntoIntelligence writes network summary", () => {
  const merged = mergeWeatherSummaryIntoIntelligence(
    baseIntel(),
    "Current 91°F in Gilbert; high 93°F / low 80°F; overcast skies."
  );
  assert.equal(
    merged?.weatherSummary,
    "Current 91°F in Gilbert; high 93°F / low 80°F; overcast skies."
  );
});
