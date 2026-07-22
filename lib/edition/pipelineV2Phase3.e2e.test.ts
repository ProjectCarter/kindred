import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPhase3ScenarioDefinitions,
  formatPhase3Report,
  getRepairStagesForDesk,
  mockValidationReport,
  runPhase3StressBatch,
  runPhase3ValidationSuite,
  runPipelineScenario,
  simulateRequeueEditionBuildStages,
  verifyDeskRepairMapping,
} from "./pipelineV2Simulation.ts";
import {
  canAttemptRepair,
  isPublicationEligibleForRepairFlow,
  MAX_AUTOMATIC_REPAIR_ATTEMPTS_PER_STAGE,
  planSectionRepairs,
} from "./sectionRepair.ts";
import { emptyEditionBuildValidationState } from "./editionValidationTypes.ts";
import { EDITION_BUILD_STAGES } from "./editionBuildStages.ts";

test("Phase 3 suite — all scenarios pass", () => {
  const report = runPhase3ValidationSuite();
  for (const result of report.scenarioResults) {
    assert.equal(
      result.passed,
      true,
      `${result.id}: ${result.failures.join("; ")}`
    );
  }
  assert.equal(report.scenariosPassed, report.scenariosRun);
  assert.equal(report.unnecessaryReruns, 0);
  assert.equal(report.validationHistoryIntegrity, true);
  assert.equal(report.diagnosticQuality, true);
  assert.equal(report.phase4Recommendation, "ready");
});

test("Phase 3 — requeue RPC simulation preserves validation history fields", () => {
  const job = simulateRequeueEditionBuildStages(
    {
      completedStages: [...EDITION_BUILD_STAGES],
      buildStage: "publish_edition",
      status: "running",
      buildState: {
        validation: {
          ...emptyEditionBuildValidationState(false),
          reportsByAttempt: [mockValidationReport({ overallStatus: "FAIL" })],
          repairHistory: [],
        },
      },
      stageDiagnostics: [],
      lastError: null,
    },
    ["activities"]
  );
  assert.deepEqual(
    job.completedStages.filter((s) => s === "activities"),
    []
  );
  assert.equal(job.buildStage, "activities");
  assert.equal(job.status, "pending");
  assert.equal(
    (job.buildState.validation as { reportsByAttempt: unknown[] }).reportsByAttempt
      .length,
    1
  );
});

test("Phase 3 — Local News maps to local_news only", () => {
  const mapping = verifyDeskRepairMapping(
    "local_news",
    "local_news:empty_briefing",
    ["local_news"]
  );
  assert.equal(mapping.accurate, true);
  assert.deepEqual(getRepairStagesForDesk("local_news"), ["local_news"]);
});

test("Phase 3 — warning-tier Local News does not auto-repair under V1 orchestration", () => {
  const plan = planSectionRepairs(
    mockValidationReport({
      overallStatus: "WARNING",
      warnings: ["local_news:empty_briefing"],
    }),
    emptyEditionBuildValidationState(false),
    { banditsPickEnabled: false }
  );
  assert.equal(plan.allowed, false);
  assert.equal(plan.unresolvedReason, "validation_warning_publish_without_repair");
  assert.equal(isPublicationEligibleForRepairFlow(mockValidationReport({ overallStatus: "WARNING" })), true);
});

test("Phase 3 — repair attempt limit matches configured max", () => {
  assert.equal(MAX_AUTOMATIC_REPAIR_ATTEMPTS_PER_STAGE, 1);
  let state = emptyEditionBuildValidationState(false);
  assert.equal(canAttemptRepair("local_events", state), true);
  state = { ...state, repairAttempts: { local_events: 1 } };
  assert.equal(canAttemptRepair("local_events", state), false);
});

test("Phase 3 — successful repair preserves then extends validation history", () => {
  const result = runPipelineScenario({
    id: "history_integrity",
    description: "validation history append-only through repair + publish",
    steps: [
      {
        type: "validate",
        report: mockValidationReport({
          blockingFailures: ["food_drinks:empty_pool"],
        }),
      },
      {
        type: "validate",
        report: mockValidationReport({
          overallStatus: "PASS",
          blockingFailures: [],
        }),
      },
    ],
    expectedRepairStages: ["food_drinks"],
    expectPublish: true,
  });
  assert.equal(result.passed, true);
  assert.ok(result.validationHistoryLength >= 2);
  assert.ok(result.repairHistoryLength >= 1);
});

test("Phase 3 — stress batch never full-regenerates edition", () => {
  const stress = runPhase3StressBatch(50);
  assert.equal(stress.fullRegenDetected, 0);
  assert.equal(stress.initializeEditionRequeued, 0);
  assert.ok(stress.maxRepairCost <= 3);
});

test("Phase 3 — Bandit's Pick disabled returns empty repair stages", () => {
  assert.deepEqual(
    getRepairStagesForDesk("bandits_pick", { banditsPickEnabled: false }),
    []
  );
  const publishOnly = runPipelineScenario({
    id: "bandits_disabled_publish",
    description: "disabled bandits pick does not block publish",
    steps: [
      {
        type: "validate",
        report: mockValidationReport({
          overallStatus: "PASS",
          warnings: ["bandits_pick:disabled"],
        }),
      },
    ],
    banditsPickEnabled: false,
    expectPublish: true,
  });
  assert.equal(publishOnly.passed, true);
});

test("Phase 3 — report formatter includes required sections", () => {
  const report = runPhase3ValidationSuite();
  const text = formatPhase3Report(report);
  assert.match(text, /Repair accuracy/);
  assert.match(text, /Unnecessary reruns/);
  assert.match(text, /Validation history integrity/);
  assert.match(text, /Recommendation/);
});

test("Phase 3 — scenario catalog covers required failure modes", () => {
  const ids = new Set(buildPhase3ScenarioDefinitions().map((s) => s.id));
  const required = [
    "local_events_only",
    "activities_only",
    "food_drinks_only",
    "local_news_mapping",
    "national_package_invalid",
    "weather_warning_publishes",
    "missing_national_news_warning",
    "missing_masterpiece_warning",
    "missing_today_in_history_warning",
    "bandits_pick_disabled_skipped",
    "multiple_independent_blocking_failures",
    "successful_repair_then_publish",
    "repair_limit_fail_cleanly",
  ];
  for (const id of required) {
    assert.ok(ids.has(id), `missing scenario ${id}`);
  }
});
