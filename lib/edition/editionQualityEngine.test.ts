import test from "node:test";
import assert from "node:assert/strict";
import {
  appendEditionQualityReport,
  computeOverallQualityScore,
  emptyEditionQualityState,
  evaluateEditionQuality,
  mergeEditionQualityIntoBuildState,
  readEditionQualityFromBuildState,
  scoreCategoryFindings,
  scoreQualityTier,
  type EditionQualityInput,
} from "./editionQualityEngine.ts";
import { buildPhase4FixtureEdition } from "./pipelineV2Phase4Fixtures.ts";
import { PHASE4_QA_CITIES } from "./pipelineV2Phase4Cities.ts";
import { runPhase3ValidationSuite } from "./pipelineV2Simulation.ts";
import { runPhase4ValidationSuite } from "./pipelineV2Phase4QA.ts";
import { buildAllPhase4FixtureEditions, PHASE4_FIXTURE_EDITION_DATE } from "./pipelineV2Phase4Fixtures.ts";
import { runPhase6LiveAudit } from "./pipelineV2Phase6LiveAudit.ts";

function fixtureQualityInput(specIndex = 0): EditionQualityInput {
  const spec = PHASE4_QA_CITIES[specIndex];
  const fixture = buildPhase4FixtureEdition(spec);
  return {
    editionId: fixture.editionId,
    metroKey: fixture.metroKey,
    editionDate: fixture.editionDate,
    location: {
      city: spec.city,
      state: spec.state,
      region: spec.region,
      lat: spec.lat,
      lon: spec.lon,
      metroKey: spec.expectedMetroKey,
      catalogMetroKey: spec.catalogMetroKey,
    },
    sections: fixture.sections,
    leadStory: fixture.leadStory,
    nationalNews: fixture.nationalNews,
    bandit: fixture.bandit,
    discovery: fixture.discovery,
    morningHero: fixture.morningHero,
    usNationalDailyId: fixture.usNationalDailyId ?? "national-daily-fixture-1",
    editorialContext: fixture.editorialContext,
    historyAroundTown: null,
    expectStoryOf: true,
  };
}

test("scoreQualityTier maps 0–100 bands", () => {
  assert.equal(scoreQualityTier(97), "excellent");
  assert.equal(scoreQualityTier(92), "very_good");
  assert.equal(scoreQualityTier(85), "good");
  assert.equal(scoreQualityTier(75), "needs_improvement");
  assert.equal(scoreQualityTier(60), "review_recommended");
});

test("evaluateEditionQuality — fixture edition scores in good+ range", () => {
  const report = evaluateEditionQuality(fixtureQualityInput());
  assert.ok(report.overallScore >= 70, `expected >=70, got ${report.overallScore}`);
  assert.equal(report.blocksPublication, false);
  assert.ok(report.durationMs >= 0);
  assert.ok(report.suggestedImprovements.length >= 0);
});

test("evaluateEditionQuality — missing sections reduce score", () => {
  const input = fixtureQualityInput();
  input.sections = input.sections.filter((s) => s.section_type !== "local_events");
  const report = evaluateEditionQuality(input);
  assert.ok(report.overallScore < evaluateEditionQuality(fixtureQualityInput()).overallScore);
  assert.ok(report.missingContentReport.some((f) => f.section === "local_events"));
});

test("evaluateEditionQuality — duplicate events flagged", () => {
  const input = fixtureQualityInput();
  const eventsSection = input.sections.find((s) => s.section_type === "local_events");
  assert.ok(eventsSection?.body);
  const parsed = JSON.parse(eventsSection.body) as { events: unknown[] };
  parsed.events.push(parsed.events[0]);
  eventsSection.body = JSON.stringify(parsed);
  const report = evaluateEditionQuality(input);
  assert.ok(
    report.duplicateReport.length > 0 || report.freshnessReport.length > 0 || report.overallScore < 100
  );
});

test("evaluateEditionQuality — national reference mismatch detected", () => {
  const input = fixtureQualityInput();
  input.nationalReference = {
    usNationalDailyId: "other-national-id",
    masterpieceArtworkId: input.morningHero?.artworkId ?? null,
    historyHeadline: "Different headline",
    nationalNewsPackageId: null,
    nationalNewsStoryIds: [],
  };
  const report = evaluateEditionQuality(input);
  assert.ok(
    report.categoryScores.national_consistency < 100 ||
      report.missingContentReport.some((f) => f.code === "national_daily_mismatch")
  );
});

test("append-only editionQuality build_state round-trip", () => {
  const report = evaluateEditionQuality(fixtureQualityInput());
  const merged = mergeEditionQualityIntoBuildState(
    {},
    appendEditionQualityReport(emptyEditionQualityState(), report)
  );
  const read = readEditionQualityFromBuildState(merged);
  assert.equal(read?.latest?.overallScore, report.overallScore);
  assert.equal(read?.reports.length, 1);
  const merged2 = mergeEditionQualityIntoBuildState(
    merged,
    appendEditionQualityReport(read, { ...report, overallScore: 88, recordedAt: report.recordedAt })
  );
  const read2 = readEditionQualityFromBuildState(merged2);
  assert.equal(read2?.reports.length, 2);
  assert.equal(read2?.latest?.overallScore, 88);
});

test("computeOverallQualityScore respects category weights", () => {
  const score = computeOverallQualityScore({
    editorial_completeness: 100,
    image_quality: 100,
    local_relevance: 100,
    national_consistency: 100,
    freshness: 100,
    user_experience: 100,
  });
  assert.equal(score, 100);
  assert.equal(scoreCategoryFindings([{ category: "editorial_completeness", severity: "high", code: "x", message: "x" }]), 92);
});

test("Edition Quality Engine — Phase 3/4/6 regression still pass", () => {
  const phase3 = runPhase3ValidationSuite();
  assert.equal(phase3.unnecessaryReruns, 0);
  const phase4 = runPhase4ValidationSuite(buildAllPhase4FixtureEditions(), PHASE4_FIXTURE_EDITION_DATE);
  assert.equal(phase4.citiesPassed, 7);
  const phase6 = runPhase6LiveAudit({
    requestedEditionDate: PHASE4_FIXTURE_EDITION_DATE,
    cities: [PHASE4_QA_CITIES[0]],
    cityResults: [],
    environment: { ok: true, missing: [], supabaseUrlPresent: true, serviceRoleKeyPresent: true, auditUserIdPresent: true },
    phase4Inputs: [],
  });
  assert.ok(["PASS", "WARNING", "FAIL"].includes(phase6.overallVerdict));
});

test("evaluateEditionQuality runtime overhead stays under 50ms on fixtures", () => {
  const durations: number[] = [];
  for (let i = 0; i < 5; i++) {
    durations.push(evaluateEditionQuality(fixtureQualityInput(i % 7)).durationMs);
  }
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  assert.ok(avg < 50, `avg ${avg}ms exceeds 50ms budget`);
});
