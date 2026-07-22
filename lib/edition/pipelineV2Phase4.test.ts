import test from "node:test";
import assert from "node:assert/strict";
import { PHASE4_QA_CITIES } from "./pipelineV2Phase4Cities.ts";
import {
  auditPhase4Edition,
  formatPhase4Report,
  runPhase4ValidationSuite,
} from "./pipelineV2Phase4QA.ts";
import {
  buildAllPhase4FixtureEditions,
  buildBleedFixtureEdition,
  buildPhase4FixtureEdition,
  PHASE4_FIXTURE_EDITION_DATE,
} from "./pipelineV2Phase4Fixtures.ts";
import { runPhase3ValidationSuite } from "./pipelineV2Simulation.ts";

test("Phase 4 — all seven required cities are registered", () => {
  const labels = PHASE4_QA_CITIES.map((c) => c.label).sort();
  assert.deepEqual(labels, [
    "Chicago",
    "Cincinnati",
    "Gilbert",
    "Miami",
    "New York",
    "Phoenix",
    "Seattle",
  ]);
});

test("Phase 4 — fixture editions pass QA for all cities", () => {
  const report = runPhase4ValidationSuite(
    buildAllPhase4FixtureEditions(),
    PHASE4_FIXTURE_EDITION_DATE
  );
  assert.equal(report.citiesRun, 7);
  assert.equal(report.citiesPassed, 7);
  assert.equal(report.overallPassRate, 1);
  assert.equal(report.nationalParityIssues.length, 0);
  assert.equal(report.localDistinctIssues.length, 0);
  assert.equal(report.recommendation, "ready_for_v1");
});

test("Phase 4 — cross-city bleed is detected", () => {
  const bleed = auditPhase4Edition(buildBleedFixtureEdition());
  assert.equal(bleed.passed, false);
  assert.ok(
    bleed.findings.some((f) => f.category === "cross_city_bleed"),
    "expected cross_city_bleed finding"
  );
});

test("Phase 4 — national content shared across cities", () => {
  const editions = buildAllPhase4FixtureEditions();
  const ids = editions.map((e) => e.usNationalDailyId);
  assert.ok(ids.every((id) => id === "national-daily-fixture-1"));
  const report = runPhase4ValidationSuite(editions, PHASE4_FIXTURE_EDITION_DATE);
  assert.equal(report.nationalParityIssues.length, 0);
});

test("Phase 4 — local desks differ per city", () => {
  const editions = buildAllPhase4FixtureEditions();
  const weatherBodies = new Set(
    editions.map((e) => e.sections.find((s) => s.section_type === "weather")?.body)
  );
  assert.equal(weatherBodies.size, 7);
});

test("Phase 4 — pipeline metrics captured", () => {
  const result = auditPhase4Edition(buildPhase4FixtureEdition(PHASE4_QA_CITIES[0]));
  assert.equal(result.pipeline.generationMs, 45_000);
  assert.equal(result.pipeline.validationStatus, "PASS");
  assert.equal(result.pipeline.fullEditionRegeneration, false);
});

test("Phase 4 — Phase 3 pipeline invariants still hold", () => {
  const phase3 = runPhase3ValidationSuite();
  assert.equal(phase3.phase4Recommendation, "ready");
  assert.equal(phase3.unnecessaryReruns, 0);
});

test("Phase 4 — report formatter includes required sections", () => {
  const report = runPhase4ValidationSuite(
    buildAllPhase4FixtureEditions(),
    PHASE4_FIXTURE_EDITION_DATE
  );
  const text = formatPhase4Report(report);
  assert.match(text, /Overall pass rate/);
  assert.match(text, /Per-section scorecard/);
  assert.match(text, /Performance metrics/);
  assert.match(text, /Recommendation/);
});

test("Phase 4 — duplicate events fail QA", () => {
  const base = buildPhase4FixtureEdition(PHASE4_QA_CITIES[2]);
  const dupEvent = {
    name: "Seattle Summer Concert",
    city: "Seattle",
    venue: "Duplicate Venue",
    startDate: `${PHASE4_FIXTURE_EDITION_DATE}T20:00:00`,
    lat: 47.6,
    lon: -122.3,
  };
  const sections = base.sections.map((s) => {
    if (s.section_type !== "local_events") return s;
    const parsed = JSON.parse(s.body) as { events: unknown[] };
    parsed.events.push(dupEvent);
    return { ...s, body: JSON.stringify(parsed) };
  });
  const result = auditPhase4Edition({ ...base, sections });
  assert.ok(result.findings.some((f) => f.category === "duplicate_event"));
});

test("Phase 4 — per-section scorecards cover required desks", () => {
  const result = auditPhase4Edition(buildPhase4FixtureEdition(PHASE4_QA_CITIES[1]));
  const sections = new Set(result.sectionScorecards.map((s) => s.section));
  for (const desk of [
    "general",
    "local_events",
    "activities",
    "food_drinks",
    "story_of",
    "masterpiece",
    "today_in_history",
    "local_news",
    "national_news",
    "images",
    "pipeline",
  ]) {
    assert.ok(sections.has(desk), `missing section scorecard ${desk}`);
  }
});
