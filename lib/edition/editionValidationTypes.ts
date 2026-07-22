/**
 * Edition Pipeline V2 — validation report types (client + server).
 *
 * Publication severity (Kindred V1) lives in `publicationSeverity.ts`:
 * blocking = local_events, activities, food_drinks;
 * warning = weather, story_of, local_news, national_news;
 * non-blocking = masterpiece, today_in_history, history_around_town, bandits_pick.
 */

export const EDITION_VALIDATION_VERSION = 1 as const;

export type EditionValidationDesk =
  | "local_events"
  | "activities"
  | "food_drinks"
  | "weather"
  | "story_of"
  | "history_around_town"
  | "local_news"
  | "national_news"
  | "masterpiece"
  | "today_in_history"
  | "bandits_pick"
  | "edition";

export type DeskValidationStatus = "PASS" | "WARNING" | "FAIL" | "SKIPPED";

export type DeskValidationCheck = {
  id: string;
  status: DeskValidationStatus;
  message?: string;
};

export type DeskValidationReport = {
  desk: EditionValidationDesk;
  status: DeskValidationStatus;
  checks: DeskValidationCheck[];
  reasons: string[];
  relatedBuildStages: string[];
};

export type TechnicalValidationOverallStatus = "PASS" | "WARNING" | "FAIL";

export type TechnicalValidationReport = {
  version: typeof EDITION_VALIDATION_VERSION;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  /** true when validation can block publish_edition; false for dry-run only. */
  enforcing: boolean;
  overallStatus: TechnicalValidationOverallStatus;
  deskReports: DeskValidationReport[];
  blockingFailures: string[];
  warnings: string[];
  externalChecks: {
    attempted: number;
    durationMs: number;
    warnings: number;
    failures: number;
  };
  completeness?: {
    complete: boolean;
    reasons: string[];
  };
};

export type OptionalStageFailureRecord = {
  stage: string;
  failureType: "optional_stage_error";
  errorSummary: string;
  attemptNumber: number;
  markedComplete: boolean;
  eligibleForValidation: boolean;
  at: string;
};

export type SectionRepairPlan = {
  allowed: boolean;
  stages: string[];
  stageReasons: Record<string, string>;
  desksTargeted: EditionValidationDesk[];
  skippedStages: Array<{ stage: string; reason: string }>;
  unresolvedReason?: string;
};

export type SectionRepairRecord = {
  plannedAt: string;
  completedAt: string | null;
  stages: string[];
  stageReasons: Record<string, string>;
  triggeredByValidationAt: string;
  unresolved: boolean;
  unresolvedReason: string | null;
};

export type EditionBuildValidationState = {
  version: typeof EDITION_VALIDATION_VERSION;
  earlyPaintEnabled: boolean;
  technicalValidationAttempts: number;
  repairAttempts: Record<string, number>;
  latestReport: TechnicalValidationReport | null;
  reportsByAttempt: TechnicalValidationReport[];
  publicationDecision: {
    allowed: boolean;
    at: string | null;
    reason: string | null;
  };
  optionalStageFailures: OptionalStageFailureRecord[];
  repairHistory: SectionRepairRecord[];
  latestRepair: SectionRepairRecord | null;
};

export function emptyEditionBuildValidationState(
  earlyPaintEnabled: boolean
): EditionBuildValidationState {
  return {
    version: EDITION_VALIDATION_VERSION,
    earlyPaintEnabled,
    technicalValidationAttempts: 0,
    repairAttempts: {},
    latestReport: null,
    reportsByAttempt: [],
    publicationDecision: {
      allowed: false,
      at: null,
      reason: null,
    },
    optionalStageFailures: [],
    repairHistory: [],
    latestRepair: null,
  };
}

export function mergeValidationIntoBuildState(
  buildState: Record<string, unknown> | null | undefined,
  validation: EditionBuildValidationState
): Record<string, unknown> {
  return {
    ...(buildState ?? {}),
    validation,
  };
}

export function readValidationFromBuildState(
  buildState: Record<string, unknown> | null | undefined
): EditionBuildValidationState | null {
  const raw = buildState?.validation;
  if (!raw || typeof raw !== "object") return null;
  return raw as EditionBuildValidationState;
}
