/**
 * Edition Pipeline V2 Phase 2 — targeted section repair planner.
 * Maps validation failures to the smallest set of build stages to requeue.
 */

import {
  EDITION_BUILD_STAGES,
  type EditionBuildStage,
  stageIndex,
} from "./editionBuildStages.ts";
import type {
  EditionBuildValidationState,
  EditionValidationDesk,
  TechnicalValidationReport,
  SectionRepairPlan,
  SectionRepairRecord,
} from "./editionValidationTypes.ts";
import { isBlockingPublicationDesk } from "./publicationSeverity.ts";

export const MAX_AUTOMATIC_REPAIR_ATTEMPTS_PER_STAGE = 1;

const DESK_PREFIX_PATTERN =
  /^(local_events|activities|food_drinks|weather|story_of|history_around_town|local_news|national_news|masterpiece|today_in_history|bandits_pick|edition):/;

export function parseDeskFromBlockingFailure(
  failure: string
): EditionValidationDesk | null {
  const match = failure.match(DESK_PREFIX_PATTERN);
  if (!match) return null;
  return match[1] as EditionValidationDesk;
}

export function getRepairStagesForDesk(
  desk: EditionValidationDesk,
  opts?: {
    sharedNationalPackageInvalid?: boolean;
    banditsPickEnabled?: boolean;
  }
): EditionBuildStage[] {
  switch (desk) {
    case "local_events":
      return ["local_events"];
    case "activities":
      return ["activities"];
    case "food_drinks":
      return ["food_drinks"];
    case "weather":
      return ["weather"];
    case "story_of":
    case "history_around_town":
      return ["story_of"];
    case "local_news":
      return ["local_news"];
    case "national_news":
    case "masterpiece":
    case "today_in_history":
      if (opts?.sharedNationalPackageInvalid) {
        return ["generate_national_daily", "attach_national_daily"];
      }
      return ["attach_national_daily"];
    case "bandits_pick":
      return opts?.banditsPickEnabled ? ["bandits_pick"] : [];
    default:
      return [];
  }
}

export function requiresSharedNationalDailyRegeneration(
  report: TechnicalValidationReport
): boolean {
  const hay = [...report.blockingFailures, ...report.warnings].join(" ");
  return (
    /shared_national_package|national_daily_package|generate_national_daily/i.test(
      hay
    ) || report.blockingFailures.some((f) => f.includes("shared_package_invalid"))
  );
}

export function isCrossSectionDiscoveryFailure(
  report: TechnicalValidationReport
): boolean {
  const blocking = report.blockingFailures;
  const hasActivities = blocking.some((f) => f.startsWith("activities:"));
  const hasFood = blocking.some((f) => f.startsWith("food_drinks:"));
  if (hasActivities && hasFood) return true;

  const combined = [...blocking, ...report.warnings].join(" ");
  if (/cross.?section|allocation.*fail|duplicate.*alloc/i.test(combined)) {
    return hasActivities || hasFood;
  }
  return false;
}

export function localEventsInvalidatesDiscovery(
  report: TechnicalValidationReport
): boolean {
  const blocking = report.blockingFailures;
  const localFails = blocking.some((f) => f.startsWith("local_events:"));
  if (!localFails) return false;
  return (
    blocking.some((f) => f.startsWith("activities:")) ||
    blocking.some((f) => f.startsWith("food_drinks:"))
  );
}

export function canAttemptRepair(
  stage: EditionBuildStage,
  validationState: EditionBuildValidationState | null | undefined
): boolean {
  if (stage === "initialize_edition") return false;
  const attempts = validationState?.repairAttempts?.[stage] ?? 0;
  return attempts < MAX_AUTOMATIC_REPAIR_ATTEMPTS_PER_STAGE;
}

export function recordRepairAttempt(
  stage: EditionBuildStage,
  validationState: EditionBuildValidationState
): EditionBuildValidationState {
  const prev = validationState.repairAttempts[stage] ?? 0;
  return {
    ...validationState,
    repairAttempts: {
      ...validationState.repairAttempts,
      [stage]: prev + 1,
    },
  };
}

function uniqueStagesInPipelineOrder(stages: EditionBuildStage[]): EditionBuildStage[] {
  const seen = new Set<EditionBuildStage>();
  const ordered: EditionBuildStage[] = [];
  for (const stage of EDITION_BUILD_STAGES) {
    if (stages.includes(stage) && !seen.has(stage)) {
      seen.add(stage);
      ordered.push(stage);
    }
  }
  return ordered;
}

function desksFromBlockingFailures(
  report: TechnicalValidationReport
): EditionValidationDesk[] {
  const desks = new Set<EditionValidationDesk>();
  for (const failure of report.blockingFailures) {
    const desk = parseDeskFromBlockingFailure(failure);
    if (desk) desks.add(desk);
  }
  return [...desks];
}

/** Build ordered repair stage list for explicit desks (tests + planner). */
export function buildRepairStageList(input: {
  desks: EditionValidationDesk[];
  report: TechnicalValidationReport;
  banditsPickEnabled: boolean;
}): EditionBuildStage[] {
  const { report, banditsPickEnabled } = input;
  let desks = [...input.desks];
  const sharedNationalInvalid = requiresSharedNationalDailyRegeneration(report);
  const stages: EditionBuildStage[] = [];

  if (isCrossSectionDiscoveryFailure(report)) {
    stages.push("activities", "food_drinks");
    desks = desks.filter((d) => d !== "activities" && d !== "food_drinks");
  }

  if (localEventsInvalidatesDiscovery(report)) {
    if (!stages.includes("local_events")) {
      stages.unshift("local_events");
    }
    desks = desks.filter((d) => d !== "local_events");
    for (const downstream of ["activities", "food_drinks"] as const) {
      if (
        report.blockingFailures.some((f) => f.startsWith(`${downstream}:`)) &&
        !stages.includes(downstream)
      ) {
        stages.push(downstream);
      }
    }
    desks = desks.filter((d) => d !== "activities" && d !== "food_drinks");
  }

  for (const desk of desks) {
    const mapped = getRepairStagesForDesk(desk, {
      sharedNationalPackageInvalid: sharedNationalInvalid,
      banditsPickEnabled,
    });
    for (const stage of mapped) {
      if (!stages.includes(stage)) stages.push(stage);
    }
  }

  return uniqueStagesInPipelineOrder(stages);
}

export function planSectionRepairs(
  report: TechnicalValidationReport,
  validationState: EditionBuildValidationState | null | undefined,
  opts: { banditsPickEnabled: boolean }
): SectionRepairPlan {
  if (report.overallStatus === "PASS") {
    return {
      allowed: false,
      stages: [],
      stageReasons: {},
      desksTargeted: [],
      skippedStages: [],
      unresolvedReason: "validation_passed",
    };
  }

  if (report.overallStatus === "WARNING") {
    return {
      allowed: false,
      stages: [],
      stageReasons: {},
      desksTargeted: [],
      skippedStages: [],
      unresolvedReason: "validation_warning_publish_without_repair",
    };
  }

  const infrastructureFailures = report.blockingFailures.filter(
    (f) => !parseDeskFromBlockingFailure(f)
  );
  const desksTargeted = desksFromBlockingFailures(report).filter((desk) =>
    isBlockingPublicationDesk(desk)
  );

  if (!desksTargeted.length) {
    return {
      allowed: false,
      stages: [],
      stageReasons: {},
      desksTargeted: [],
      skippedStages: [],
      unresolvedReason:
        infrastructureFailures.length > 0
          ? "infrastructure_failure_not_repairable"
          : "no_repairable_blocking_desks",
    };
  }

  const candidateStages = buildRepairStageList({
    desks: desksTargeted,
    report,
    banditsPickEnabled: opts.banditsPickEnabled,
  });

  const stageReasons: Record<string, string> = {};
  const skippedStages: SectionRepairPlan["skippedStages"] = [];
  const allowedStages: EditionBuildStage[] = [];

  for (const stage of candidateStages) {
    if (stage === "initialize_edition") {
      skippedStages.push({ stage, reason: "initialize_edition_never_requeued" });
      continue;
    }
    if (!canAttemptRepair(stage, validationState)) {
      skippedStages.push({ stage, reason: "repair_attempt_limit_reached" });
      continue;
    }
    allowedStages.push(stage);
    const desk = desksTargeted.find((d) =>
      getRepairStagesForDesk(d, {
        sharedNationalPackageInvalid: requiresSharedNationalDailyRegeneration(report),
        banditsPickEnabled: opts.banditsPickEnabled,
      }).includes(stage)
    );
    stageReasons[stage] = desk
      ? `${desk}_validation_failure`
      : "cross_section_or_dependency_repair";
  }

  if (!allowedStages.length) {
    return {
      allowed: false,
      stages: [],
      stageReasons,
      desksTargeted,
      skippedStages,
      unresolvedReason: "repair_attempt_limit_reached",
    };
  }

  return {
    allowed: true,
    stages: allowedStages,
    stageReasons,
    desksTargeted,
    skippedStages,
  };
}

export function isPublicationEligibleForRepairFlow(
  report: TechnicalValidationReport
): boolean {
  return report.overallStatus === "PASS" || report.overallStatus === "WARNING";
}

export function applyRepairPlanToValidationState(
  validationState: EditionBuildValidationState,
  plan: SectionRepairPlan,
  report: TechnicalValidationReport
): EditionBuildValidationState {
  let next = validationState;
  for (const stage of plan.stages) {
    if (stage === "initialize_edition") continue;
    next = recordRepairAttempt(stage as EditionBuildStage, next);
  }

  const repairRecord: SectionRepairRecord = {
    plannedAt: new Date().toISOString(),
    completedAt: null,
    stages: plan.stages,
    stageReasons: plan.stageReasons,
    triggeredByValidationAt: report.completedAt,
    unresolved: !plan.allowed,
    unresolvedReason: plan.unresolvedReason ?? null,
  };

  return {
    ...next,
    latestRepair: repairRecord,
    repairHistory: [...next.repairHistory, repairRecord],
  };
}

export function applyUnresolvedRepairToValidationState(
  validationState: EditionBuildValidationState,
  plan: SectionRepairPlan,
  report: TechnicalValidationReport
): EditionBuildValidationState {
  const repairRecord: SectionRepairRecord = {
    plannedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    stages: plan.stages,
    stageReasons: plan.stageReasons,
    triggeredByValidationAt: report.completedAt,
    unresolved: true,
    unresolvedReason: plan.unresolvedReason ?? "repair_not_allowed",
  };

  return {
    ...validationState,
    latestRepair: repairRecord,
    repairHistory: [...validationState.repairHistory, repairRecord],
    publicationDecision: {
      allowed: false,
      at: new Date().toISOString(),
      reason: plan.unresolvedReason ?? "repair_not_allowed",
    },
  };
}
