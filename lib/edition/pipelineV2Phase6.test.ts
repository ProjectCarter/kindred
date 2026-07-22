import test from "node:test";
import assert from "node:assert/strict";
import { PHASE4_QA_CITIES } from "./pipelineV2Phase4Cities.ts";
import { buildPhase4FixtureEdition } from "./pipelineV2Phase4Fixtures.ts";
import {
  assessPhase6Environment,
  auditLiveCity,
  auditRepairHistory,
  buildPhase4InputFromLiveRows,
  formatPhase6LaunchReport,
  NOT_RECORDED,
  parseAuditCityFilter,
  resolveEditionDatePreference,
  runPhase6LiveAudit,
  wrapReadOnlySupabaseClient,
  type LiveEditionRow,
  type Phase6EditionResolution,
} from "./pipelineV2Phase6LiveAudit.ts";
import {
  emptyEditionBuildValidationState,
  mergeValidationIntoBuildState,
  type TechnicalValidationReport,
} from "./editionValidationTypes.ts";
import { runPhase3ValidationSuite } from "./pipelineV2Simulation.ts";
import { runPhase4ValidationSuite } from "./pipelineV2Phase4QA.ts";
import { buildAllPhase4FixtureEditions } from "./pipelineV2Phase4Fixtures.ts";

function mockReport(
  overrides: Partial<TechnicalValidationReport> = {}
): TechnicalValidationReport {
  return {
    version: 1,
    startedAt: "2026-07-22T00:00:00.000Z",
    completedAt: "2026-07-22T00:00:01.000Z",
    durationMs: 850,
    enforcing: true,
    overallStatus: "PASS",
    deskReports: [],
    blockingFailures: [],
    warnings: [],
    externalChecks: { attempted: 0, durationMs: 0, warnings: 0, failures: 0 },
    ...overrides,
  };
}

test("Phase 6 — parseAuditCityFilter respects AUDIT_CITIES", () => {
  const filtered = parseAuditCityFilter("gilbert-az,seattle-wa");
  assert.equal(filtered.length, 2);
  assert.equal(filtered[0]?.expectedMetroKey, "gilbert-az");
  assert.equal(filtered[1]?.expectedMetroKey, "seattle-wa");
});

test("Phase 6 — resolveEditionDatePreference marks stale editions", () => {
  const fresh = resolveEditionDatePreference("2026-07-22", "2026-07-22");
  assert.equal(fresh.isStaleEdition, false);
  assert.equal(fresh.staleReason, null);

  const stale = resolveEditionDatePreference("2026-07-22", "2026-07-21");
  assert.equal(stale.isStaleEdition, true);
  assert.ok(stale.staleReason?.includes("2026-07-21"));
});

test("Phase 6 — missing edition is launch FAIL", () => {
  const resolution: Phase6EditionResolution = {
    found: false,
    requestedEditionDate: "2026-07-22",
    actualEditionDate: null,
    isStaleEdition: false,
    staleReason: "no ready edition found",
    editionId: null,
    editionStatus: null,
  };
  const result = auditLiveCity({
    spec: PHASE4_QA_CITIES[0],
    resolution,
    edition: null,
    sections: [],
    job: null,
  });
  assert.equal(result.cityVerdict, "FAIL");
  assert.ok(result.launchBlockers.some((f) => f.category === "edition_missing"));
});

test("Phase 6 — read-only Supabase client blocks writes", () => {
  const fake = {
    from() {
      return {
        select() {
          return {
            insert() {
              return "would mutate";
            },
          };
        },
        insert() {
          return "root insert";
        },
      };
    },
    rpc() {
      return null;
    },
  };
  const guarded = wrapReadOnlySupabaseClient(fake);
  assert.throws(
    () => (guarded.from("editions") as { insert: () => void }).insert(),
    /read-only/
  );
  assert.throws(
    () =>
      (
        (guarded.from("editions") as { select: () => { insert: () => void } }).select() as {
          insert: () => void;
        }
      ).insert(),
    /read-only/
  );
  assert.throws(() => guarded.rpc("mutate_edition"), /read-only/);
});

test("Phase 6 — repair audit detects full regeneration and limit exceeded", () => {
  const validation = emptyEditionBuildValidationState(false);
  validation.repairHistory = [
    {
      plannedAt: "2026-07-22T00:00:00.000Z",
      completedAt: "2026-07-22T00:01:00.000Z",
      stages: ["initialize_edition", "local_events", "activities"],
      stageReasons: {},
      triggeredByValidationAt: "2026-07-22T00:00:00.000Z",
      unresolved: false,
      unresolvedReason: null,
    },
  ];
  validation.repairAttempts = { local_events: 2 };
  const buildState = mergeValidationIntoBuildState({}, validation);
  const audit = auditRepairHistory(buildState);
  assert.equal(audit.fullEditionRegenerationDetected, true);
  assert.equal(audit.repairLimitExceeded, true);
  assert.equal(audit.passed, false);
});

test("Phase 6 — fixture-backed live audit produces WARNING without blockers", () => {
  const spec = PHASE4_QA_CITIES[0];
  const fixture = buildPhase4FixtureEdition(spec);
  const edition: LiveEditionRow = {
    id: fixture.editionId,
    metro_key: fixture.metroKey,
    edition_date: fixture.editionDate,
    status: "ready",
    lead_story: fixture.leadStory,
    national_news: fixture.nationalNews,
    bandit: fixture.bandit,
    discovery: fixture.discovery,
    editorial_context: fixture.editorialContext,
    us_national_daily_id: fixture.usNationalDailyId ?? null,
    morning_edition: fixture.morningHero ? { morningHero: fixture.morningHero } : null,
    history_around_town: { metroKey: spec.expectedMetroKey, places: [] },
  };
  const resolution: Phase6EditionResolution = {
    found: true,
    requestedEditionDate: fixture.editionDate,
    actualEditionDate: fixture.editionDate,
    isStaleEdition: false,
    staleReason: null,
    editionId: edition.id,
    editionStatus: "ready",
  };
  const validation = emptyEditionBuildValidationState(false);
  validation.latestReport = mockReport({ overallStatus: "PASS" });
  validation.publicationDecision = {
    allowed: true,
    at: "2026-07-22T00:00:00.000Z",
    reason: null,
  };
  const buildState = mergeValidationIntoBuildState({}, validation);

  const cityResult = auditLiveCity({
    spec,
    resolution,
    edition,
    sections: fixture.sections,
    job: {
      id: "job-fixture",
      status: "completed",
      build_state: buildState,
      stage_diagnostics: null,
      completed_stages: null,
      created_at: null,
      updated_at: null,
    },
  });
  assert.equal(cityResult.qaPassed, true);
  assert.equal(cityResult.launchBlockers.length, 0);
  assert.ok(
    cityResult.cityVerdict === "PASS" || cityResult.cityVerdict === "WARNING",
    "warning-tier Phase 4 findings should not fail the city"
  );

  const phase4Input = buildPhase4InputFromLiveRows({
    spec,
    edition,
    sections: fixture.sections,
    job: null,
    resolution,
  });
  const report = runPhase6LiveAudit({
    requestedEditionDate: fixture.editionDate,
    cities: [spec],
    cityResults: [cityResult],
    environment: {
      ok: true,
      missing: [],
      supabaseUrlPresent: true,
      serviceRoleKeyPresent: true,
      auditUserIdPresent: true,
    },
    phase4Inputs: [phase4Input],
  });
  assert.ok(
    report.overallVerdict === "PASS" || report.overallVerdict === "WARNING",
    "fixture city with only warning-tier findings should not FAIL launch sign-off"
  );
  assert.equal(report.aiCalls, 0);
  assert.equal(report.writeOperations, 0);
  assert.ok(formatPhase6LaunchReport(report).includes("Overall verdict"));
});

test("Phase 6 — missing metrics stay NOT RECORDED", () => {
  const spec = PHASE4_QA_CITIES[0];
  const resolution: Phase6EditionResolution = {
    found: true,
    requestedEditionDate: "2026-07-22",
    actualEditionDate: "2026-07-22",
    isStaleEdition: false,
    staleReason: null,
    editionId: "e1",
    editionStatus: "ready",
  };
  const result = auditLiveCity({
    spec,
    resolution,
    edition: {
      id: "e1",
      metro_key: spec.expectedMetroKey,
      edition_date: "2026-07-22",
      status: "ready",
      lead_story: null,
      national_news: null,
      bandit: null,
      discovery: null,
      editorial_context: null,
      us_national_daily_id: null,
      morning_edition: null,
      history_around_town: null,
    },
    sections: [],
    job: { id: "j1", status: "completed", build_state: {}, stage_diagnostics: null, completed_stages: null, created_at: null, updated_at: null },
  });
  assert.equal(result.performance.repairMs, NOT_RECORDED);
});

test("Phase 6 — environment assessment requires credentials", () => {
  const bad = assessPhase6Environment({});
  assert.equal(bad.ok, false);
  assert.ok(bad.missing.includes("SUPABASE_URL"));
  assert.ok(bad.missing.includes("SUPABASE_SERVICE_ROLE_KEY"));
  assert.ok(bad.missing.includes("AUDIT_USER_ID"));
});

test("Phase 6 — Phase 3/4 regression still pass", () => {
  const phase3 = runPhase3ValidationSuite();
  assert.equal(phase3.unnecessaryReruns, 0);
  const phase4 = runPhase4ValidationSuite(buildAllPhase4FixtureEditions(), "2026-07-22");
  assert.equal(phase4.citiesPassed, 7);
});
