import test from "node:test";
import assert from "node:assert/strict";
import {
  BLOCKING_PUBLICATION_DESKS,
} from "./publicationSeverity.ts";
import {
  buildRepairStageList,
  canAttemptRepair,
  getRepairStagesForDesk,
  planSectionRepairs,
  recordRepairAttempt,
  requiresSharedNationalDailyRegeneration,
} from "./sectionRepair.ts";
import {
  emptyEditionBuildValidationState,
  type TechnicalValidationReport,
} from "./editionValidationTypes.ts";
import {
  applyRepairPlanToValidationState,
} from "./sectionRepair.ts";
import { EDITION_BUILD_STAGES } from "./editionBuildStages.ts";

function mockReport(
  overrides: Partial<TechnicalValidationReport> = {}
): TechnicalValidationReport {
  return {
    version: 1,
    startedAt: "2026-07-22T00:00:00.000Z",
    completedAt: "2026-07-22T00:00:01.000Z",
    durationMs: 10,
    enforcing: true,
    overallStatus: "FAIL",
    deskReports: [],
    blockingFailures: [],
    warnings: [],
    externalChecks: { attempted: 0, durationMs: 0, warnings: 0, failures: 0 },
    ...overrides,
  };
}

test("Local News failure maps to local_news stage only", () => {
  assert.deepEqual(getRepairStagesForDesk("local_news"), ["local_news"]);
});

test("Weather failure maps to weather stage only", () => {
  assert.deepEqual(getRepairStagesForDesk("weather"), ["weather"]);
});

test("Activities failure requeues only activities", () => {
  const plan = planSectionRepairs(
    mockReport({ blockingFailures: ["activities:empty_pool"] }),
    emptyEditionBuildValidationState(false),
    { banditsPickEnabled: false }
  );
  assert.deepEqual(plan.stages, ["activities"]);
});

test("Food & Drinks failure requeues only food_drinks", () => {
  const plan = planSectionRepairs(
    mockReport({ blockingFailures: ["food_drinks:empty_pool"] }),
    emptyEditionBuildValidationState(false),
    { banditsPickEnabled: false }
  );
  assert.deepEqual(plan.stages, ["food_drinks"]);
});

test("Cross-section Activities/Food duplication requeues activities then food_drinks", () => {
  const report = mockReport({
    blockingFailures: ["activities:duplicate_identity:x", "food_drinks:duplicate_identity:x"],
  });
  const plan = planSectionRepairs(report, emptyEditionBuildValidationState(false), {
    banditsPickEnabled: false,
  });
  assert.deepEqual(plan.stages, ["activities", "food_drinks"]);
});

test("National attachment failure requeues attach_national_daily only", () => {
  const stages = buildRepairStageList({
    desks: ["national_news"],
    report: mockReport({ blockingFailures: ["national_news:missing_us_national_daily_id"] }),
    banditsPickEnabled: false,
  });
  assert.deepEqual(stages, ["attach_national_daily"]);
  assert.equal(requiresSharedNationalDailyRegeneration(mockReport()), false);
});

test("Shared national package invalid may include generate_national_daily", () => {
  const stages = buildRepairStageList({
    desks: ["national_news"],
    report: mockReport({
      blockingFailures: ["national_news:shared_package_invalid"],
    }),
    banditsPickEnabled: false,
  });
  assert.deepEqual(stages, ["generate_national_daily", "attach_national_daily"]);
});

test("Passing edition performs no repair", () => {
  const plan = planSectionRepairs(
    mockReport({ overallStatus: "PASS", blockingFailures: [] }),
    emptyEditionBuildValidationState(false),
    { banditsPickEnabled: false }
  );
  assert.equal(plan.allowed, false);
  assert.deepEqual(plan.stages, []);
});

test("WARNING edition publishes without repair", () => {
  const plan = planSectionRepairs(
    mockReport({
      overallStatus: "WARNING",
      warnings: ["weather:empty_weather_section"],
    }),
    emptyEditionBuildValidationState(false),
    { banditsPickEnabled: false }
  );
  assert.equal(plan.allowed, false);
  assert.equal(plan.unresolvedReason, "validation_warning_publish_without_repair");
});

test("Repair attempt count prevents second automatic repair for same stage", () => {
  const base = emptyEditionBuildValidationState(false);
  base.repairAttempts = { activities: 1 };
  const plan = planSectionRepairs(
    mockReport({ blockingFailures: ["activities:empty_pool"] }),
    base,
    { banditsPickEnabled: false }
  );
  assert.equal(plan.allowed, false);
  assert.equal(plan.unresolvedReason, "repair_attempt_limit_reached");
});

test("initialize_edition is never requeued by targeted repair", () => {
  const plan = planSectionRepairs(
    mockReport({ blockingFailures: ["local_events:no_events"] }),
    emptyEditionBuildValidationState(false),
    { banditsPickEnabled: false }
  );
  assert.equal(plan.stages.includes("initialize_edition"), false);
});

test("build_state validation history survives repair planning", () => {
  const base = emptyEditionBuildValidationState(false);
  base.latestReport = mockReport({ overallStatus: "PASS" });
  base.reportsByAttempt = [base.latestReport];
  const plan = planSectionRepairs(
    mockReport({ blockingFailures: ["activities:empty_pool"] }),
    base,
    { banditsPickEnabled: false }
  );
  const next = applyRepairPlanToValidationState(base, plan, mockReport());
  assert.equal(next.reportsByAttempt.length, 1);
  assert.equal(next.latestReport?.overallStatus, "PASS");
  assert.equal(next.repairAttempts.activities, 1);
  assert.ok(next.latestRepair?.stages.includes("activities"));
});

test("Revalidation stage follows repaired content stages in pipeline order", () => {
  const validateIdx = EDITION_BUILD_STAGES.indexOf("validate_technical");
  const foodIdx = EDITION_BUILD_STAGES.indexOf("food_drinks");
  assert.ok(validateIdx > foodIdx);
});

test("Successful validation PASS/WARNING is publication-eligible without repair", () => {
  const passPlan = planSectionRepairs(
    mockReport({ overallStatus: "PASS" }),
    emptyEditionBuildValidationState(false),
    { banditsPickEnabled: false }
  );
  assert.equal(passPlan.stages.length, 0);
  const warnPlan = planSectionRepairs(
    mockReport({ overallStatus: "WARNING" }),
    emptyEditionBuildValidationState(false),
    { banditsPickEnabled: false }
  );
  assert.equal(warnPlan.stages.length, 0);
});

test("Failed repair records unresolved reason without planning full regeneration", () => {
  const base = emptyEditionBuildValidationState(false);
  base.repairAttempts = { local_events: 1 };
  const plan = planSectionRepairs(
    mockReport({ blockingFailures: ["local_events:no_events"] }),
    base,
    { banditsPickEnabled: false }
  );
  assert.equal(plan.allowed, false);
  assert.deepEqual(plan.stages, []);
  assert.equal(plan.unresolvedReason, "repair_attempt_limit_reached");
});

test("Bandit's Pick remains skipped while disabled", () => {
  assert.deepEqual(getRepairStagesForDesk("bandits_pick", { banditsPickEnabled: false }), []);
  const plan = planSectionRepairs(
    mockReport({ blockingFailures: ["activities:empty_pool"] }),
    emptyEditionBuildValidationState(false),
    { banditsPickEnabled: false }
  );
  assert.equal(plan.stages.includes("bandits_pick"), false);
});

test("Core discovery severity rules remain unchanged", () => {
  assert.deepEqual([...BLOCKING_PUBLICATION_DESKS].sort(), [
    "activities",
    "food_drinks",
    "local_events",
  ]);
});

test("canAttemptRepair respects per-stage limit", () => {
  let state = emptyEditionBuildValidationState(false);
  assert.equal(canAttemptRepair("local_news", state), true);
  state = recordRepairAttempt("local_news", state);
  assert.equal(canAttemptRepair("local_news", state), false);
});

test("recordRepairAttempt increments stage counter", () => {
  const state = recordRepairAttempt("weather", emptyEditionBuildValidationState(false));
  assert.equal(state.repairAttempts.weather, 1);
});
