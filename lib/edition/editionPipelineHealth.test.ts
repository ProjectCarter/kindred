import test from "node:test";
import assert from "node:assert/strict";
import {
  appendEditionPipelineHealthReport,
  buildEditionPipelineHealthReport,
  computeEditionHealthScore,
  emptyEditionPipelineHealthState,
  extractTimingFromStageTimings,
  formatEditionPipelineHealthReport,
  mergePipelineHealthIntoBuildState,
  readPipelineHealthFromBuildState,
  readPipelineStageTimings,
  recordPipelineStageTiming,
} from "./editionPipelineHealth.ts";
import {
  emptyEditionBuildValidationState,
  type TechnicalValidationReport,
} from "./editionValidationTypes.ts";

function mockReport(
  overrides: Partial<TechnicalValidationReport> = {}
): TechnicalValidationReport {
  return {
    version: 1,
    startedAt: "2026-07-22T00:00:00.000Z",
    completedAt: "2026-07-22T00:00:01.000Z",
    durationMs: 850,
    enforcing: true,
    overallStatus: "WARNING",
    deskReports: [],
    blockingFailures: [],
    warnings: ["local_news:approved_fallback"],
    externalChecks: { attempted: 0, durationMs: 0, warnings: 0, failures: 0 },
    ...overrides,
  };
}

test("extractTimingFromStageTimings sums generation stages separately", () => {
  const timing = extractTimingFromStageTimings({
    local_events: 12000,
    activities: 8000,
    validate_technical: 850,
    publish_edition: 320,
    initialize_edition: 100,
  });
  assert.equal(timing.generationMs, 20000);
  assert.equal(timing.validationMs, 850);
  assert.equal(timing.publishMs, 320);
  assert.equal(timing.totalMs, 21270);
});

test("computeEditionHealthScore — WARNING with one fallback ≈ 98", () => {
  const score = computeEditionHealthScore({
    validationStatus: "WARNING",
    blockingFailures: [],
    warnings: ["local_news:approved_fallback"],
    repairCount: 1,
    unresolvedRepair: false,
    optionalStageFailureCount: 0,
    published: true,
  });
  assert.equal(score, 98);
});

test("computeEditionHealthScore — unresolved repair penalized", () => {
  const score = computeEditionHealthScore({
    validationStatus: "FAIL",
    blockingFailures: ["activities:empty_pool"],
    warnings: [],
    repairCount: 1,
    unresolvedRepair: true,
    optionalStageFailureCount: 0,
    published: false,
  });
  assert.ok(score < 50);
});

test("buildEditionPipelineHealthReport captures repair metadata", () => {
  const validation = emptyEditionBuildValidationState(false);
  validation.latestReport = mockReport();
  validation.repairHistory = [
    {
      plannedAt: "2026-07-22T01:00:00.000Z",
      completedAt: null,
      stages: ["activities"],
      stageReasons: { activities: "activities_validation_failure" },
      triggeredByValidationAt: "2026-07-22T00:59:00.000Z",
      unresolved: false,
      unresolvedReason: null,
    },
  ];

  const report = buildEditionPipelineHealthReport({
    editionId: "ed-1",
    metroKey: "phoenix-az",
    editionDate: "2026-07-22",
    traceId: "trace-1",
    validation,
    stageTimings: {
      local_events: 10000,
      activities: 5000,
      validate_technical: 850,
      publish_edition: 320,
    },
    publicationStatus: "published",
  });

  assert.equal(report.repairCount, 1);
  assert.deepEqual(report.repairedStages, ["activities"]);
  assert.equal(report.validationStatus, "WARNING");
  assert.equal(report.finalPublicationStatus, "published");
  assert.equal(report.warnings.length, 1);
});

test("append-only health history preserves prior reports", () => {
  const first = buildEditionPipelineHealthReport({
    editionId: "ed-1",
    metroKey: "seattle-wa",
    editionDate: "2026-07-21",
    traceId: null,
    validation: null,
    stageTimings: {},
    publicationStatus: "failed",
  });
  const second = buildEditionPipelineHealthReport({
    editionId: "ed-1",
    metroKey: "seattle-wa",
    editionDate: "2026-07-22",
    traceId: null,
    validation: null,
    stageTimings: {},
    publicationStatus: "published",
  });

  const state = appendEditionPipelineHealthReport(
    appendEditionPipelineHealthReport(emptyEditionPipelineHealthState(), first),
    second
  );

  assert.equal(state.reports.length, 2);
  assert.equal(state.latest?.finalPublicationStatus, "published");
  assert.equal(state.reports[0].editionDate, "2026-07-21");
});

test("build_state round-trip for pipeline health and timings", () => {
  let buildState: Record<string, unknown> = { discovery: { version: 1 } };
  buildState = recordPipelineStageTiming(buildState, "local_events", 9000);
  buildState = recordPipelineStageTiming(buildState, "validate_technical", 800);

  const report = buildEditionPipelineHealthReport({
    editionId: "ed-2",
    metroKey: "chicago-il",
    editionDate: "2026-07-22",
    traceId: "t",
    validation: {
      ...emptyEditionBuildValidationState(false),
      latestReport: mockReport({ overallStatus: "PASS", warnings: [] }),
    },
    stageTimings: readPipelineStageTimings(buildState),
    publicationStatus: "published",
  });

  buildState = mergePipelineHealthIntoBuildState(
    buildState,
    appendEditionPipelineHealthReport(null, report)
  );

  assert.ok((buildState.discovery as { version: number }).version === 1);
  assert.equal(readPipelineStageTimings(buildState).local_events, 9000);
  assert.equal(readPipelineHealthFromBuildState(buildState)?.latest?.healthScore, 100);
});

test("formatEditionPipelineHealthReport matches ops layout", () => {
  const report = buildEditionPipelineHealthReport({
    editionId: "ed-3",
    metroKey: "miami-fl",
    editionDate: "2026-07-22",
    traceId: null,
    validation: {
      ...emptyEditionBuildValidationState(false),
      latestReport: mockReport({
        overallStatus: "WARNING",
        warnings: ["local_news:approved_fallback"],
      }),
      repairHistory: [
        {
          plannedAt: "2026-07-22T01:00:00.000Z",
          completedAt: null,
          stages: ["local_news"],
          stageReasons: {},
          triggeredByValidationAt: "2026-07-22T00:59:00.000Z",
          unresolved: false,
          unresolvedReason: null,
        },
      ],
    },
    stageTimings: {
      local_events: 40000,
      validate_technical: 1200,
      publish_edition: 400,
    },
    publicationStatus: "published",
  });

  const text = formatEditionPipelineHealthReport(report);
  assert.match(text, /Edition Health/);
  assert.match(text, /Overall: \d+\/100/);
  assert.match(text, /Validation/);
  assert.match(text, /Warnings/);
  assert.match(text, /local_news:approved_fallback/);
  assert.match(text, /Generation: 40000 ms/);
});

test("Phase 5 compatible with Phase 2 repair history shape", () => {
  const validation = emptyEditionBuildValidationState(false);
  validation.latestReport = mockReport({ overallStatus: "PASS" });
  validation.repairAttempts = { activities: 1 };
  validation.repairHistory = [
    {
      plannedAt: "2026-07-22T00:00:00.000Z",
      completedAt: null,
      stages: ["activities"],
      stageReasons: { activities: "activities_validation_failure" },
      triggeredByValidationAt: "2026-07-22T00:00:01.000Z",
      unresolved: false,
      unresolvedReason: null,
    },
  ];

  const report = buildEditionPipelineHealthReport({
    editionId: "ed-4",
    metroKey: "gilbert-az",
    editionDate: "2026-07-22",
    traceId: null,
    validation,
    stageTimings: { activities: 5000, validate_technical: 900, publish_edition: 300 },
    publicationStatus: "published",
  });

  assert.equal(report.repairCount, 1);
  assert.equal(report.sections.repairs.label, "1 targeted repair");
  assert.ok(report.healthScore >= 90);
});
