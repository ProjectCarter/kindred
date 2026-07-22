/**
 * Edition Pipeline V2 Phase 5 — production health reporting (internal ops only).
 * Objective scoring from persisted validation + stage timings — no AI, no external calls.
 */

import type { EditionBuildValidationState, TechnicalValidationReport } from "./editionValidationTypes.ts";

export const EDITION_PIPELINE_HEALTH_VERSION = 1 as const;

export type EditionPipelineHealthPublicationStatus =
  | "published"
  | "blocked"
  | "failed"
  | "unresolved_repair";

export type EditionPipelineHealthTiming = {
  generationMs: number | null;
  validationMs: number | null;
  publishMs: number | null;
  totalMs: number | null;
};

export type EditionPipelineHealthSectionStatus = {
  generation: { ok: boolean; label: string };
  validation: { ok: boolean; status: string; label: string };
  repairs: { ok: boolean; count: number; label: string };
  publication: { ok: boolean; status: EditionPipelineHealthPublicationStatus; label: string };
};

export type EditionPipelineHealthReport = {
  version: typeof EDITION_PIPELINE_HEALTH_VERSION;
  recordedAt: string;
  editionId: string;
  metroKey: string;
  editionDate: string;
  traceId: string | null;
  healthScore: number;
  finalPublicationStatus: EditionPipelineHealthPublicationStatus;
  validationStatus: TechnicalValidationReport["overallStatus"] | null;
  blockingFailures: string[];
  warnings: string[];
  repairCount: number;
  repairedStages: string[];
  timing: EditionPipelineHealthTiming;
  sections: EditionPipelineHealthSectionStatus;
};

export type EditionPipelineHealthState = {
  version: typeof EDITION_PIPELINE_HEALTH_VERSION;
  reports: EditionPipelineHealthReport[];
  latest: EditionPipelineHealthReport | null;
};

const CONTENT_GENERATION_STAGES = new Set([
  "generate_national_daily",
  "attach_national_daily",
  "weather",
  "local_events",
  "activities",
  "food_drinks",
  "story_of",
  "local_news",
  "bandits_pick",
]);

export function emptyEditionPipelineHealthState(): EditionPipelineHealthState {
  return {
    version: EDITION_PIPELINE_HEALTH_VERSION,
    reports: [],
    latest: null,
  };
}

export function readPipelineHealthFromBuildState(
  buildState: Record<string, unknown> | null | undefined
): EditionPipelineHealthState | null {
  const raw = buildState?.pipelineHealth;
  if (!raw || typeof raw !== "object") return null;
  return raw as EditionPipelineHealthState;
}

export function mergePipelineHealthIntoBuildState(
  buildState: Record<string, unknown> | null | undefined,
  health: EditionPipelineHealthState
): Record<string, unknown> {
  return {
    ...(buildState ?? {}),
    pipelineHealth: health,
  };
}

export function readPipelineStageTimings(
  buildState: Record<string, unknown> | null | undefined
): Record<string, number> {
  const raw = buildState?.pipelineStageTimings;
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = value;
    }
  }
  return out;
}

export function recordPipelineStageTiming(
  buildState: Record<string, unknown>,
  stage: string,
  elapsedMs: number
): Record<string, unknown> {
  const prev = readPipelineStageTimings(buildState);
  return {
    ...buildState,
    pipelineStageTimings: {
      ...prev,
      [stage]: elapsedMs,
    },
  };
}

export function extractTimingFromStageTimings(
  timings: Record<string, number>
): EditionPipelineHealthTiming {
  let generationMs = 0;
  let hasGeneration = false;
  for (const [stage, ms] of Object.entries(timings)) {
    if (CONTENT_GENERATION_STAGES.has(stage)) {
      generationMs += ms;
      hasGeneration = true;
    }
  }

  const validationMs = timings.validate_technical ?? null;
  const publishMs = timings.publish_edition ?? null;
  const totalMs = Object.values(timings).reduce((sum, ms) => sum + ms, 0);

  return {
    generationMs: hasGeneration ? generationMs : null,
    validationMs: validationMs ?? null,
    publishMs: publishMs ?? null,
    totalMs: totalMs > 0 ? totalMs : null,
  };
}

export function computeEditionHealthScore(input: {
  validationStatus: TechnicalValidationReport["overallStatus"] | null;
  blockingFailures: string[];
  warnings: string[];
  repairCount: number;
  unresolvedRepair: boolean;
  optionalStageFailureCount: number;
  published: boolean;
}): number {
  let score = 100;

  if (input.unresolvedRepair) score -= 40;
  if (!input.published) score -= 50;
  if (input.validationStatus === "FAIL") score -= 35;

  score -= Math.min(30, input.blockingFailures.length * 10);
  score -= Math.min(20, input.warnings.length * 2);
  score -= Math.min(15, input.optionalStageFailureCount * 5);

  return Math.max(0, Math.min(100, score));
}

export function buildEditionPipelineHealthReport(input: {
  editionId: string;
  metroKey: string;
  editionDate: string;
  traceId: string | null;
  validation: EditionBuildValidationState | null;
  stageTimings: Record<string, number>;
  publicationStatus: EditionPipelineHealthPublicationStatus;
}): EditionPipelineHealthReport {
  const report = input.validation?.latestReport ?? null;
  const repairHistory = input.validation?.repairHistory ?? [];
  const successfulRepairs = repairHistory.filter((r) => !r.unresolved);
  const repairCount = successfulRepairs.length;
  const repairedStages = [
    ...new Set(successfulRepairs.flatMap((r) => r.stages)),
  ];
  const unresolvedRepair = repairHistory.some((r) => r.unresolved);
  const optionalStageFailureCount = input.validation?.optionalStageFailures.length ?? 0;
  const published = input.publicationStatus === "published";

  const validationStatus = report?.overallStatus ?? null;
  const blockingFailures = report?.blockingFailures ?? [];
  const warnings = report?.warnings ?? [];

  const healthScore = computeEditionHealthScore({
    validationStatus,
    blockingFailures,
    warnings,
    repairCount,
    unresolvedRepair,
    optionalStageFailureCount,
    published,
  });

  const timing = extractTimingFromStageTimings(input.stageTimings);

  const repairLabel =
    repairCount === 0
      ? "None"
      : repairCount === 1
        ? "1 targeted repair"
        : `${repairCount} targeted repairs`;

  const sections: EditionPipelineHealthSectionStatus = {
    generation: {
      ok: timing.generationMs != null && timing.generationMs > 0,
      label: timing.generationMs != null ? "Completed" : "Incomplete",
    },
    validation: {
      ok: validationStatus === "PASS" || validationStatus === "WARNING",
      status: validationStatus ?? "UNKNOWN",
      label: validationStatus ?? "Not run",
    },
    repairs: {
      ok: !unresolvedRepair,
      count: repairCount,
      label: unresolvedRepair ? "Repair limit reached" : repairLabel,
    },
    publication: {
      ok: published,
      status: input.publicationStatus,
      label:
        input.publicationStatus === "published"
          ? "Published"
          : input.publicationStatus === "unresolved_repair"
            ? "Blocked — repair unresolved"
            : input.publicationStatus === "blocked"
              ? "Blocked"
              : "Failed",
    },
  };

  return {
    version: EDITION_PIPELINE_HEALTH_VERSION,
    recordedAt: new Date().toISOString(),
    editionId: input.editionId,
    metroKey: input.metroKey,
    editionDate: input.editionDate,
    traceId: input.traceId,
    healthScore,
    finalPublicationStatus: input.publicationStatus,
    validationStatus,
    blockingFailures,
    warnings,
    repairCount,
    repairedStages,
    timing,
    sections,
  };
}

export function appendEditionPipelineHealthReport(
  state: EditionPipelineHealthState | null | undefined,
  report: EditionPipelineHealthReport
): EditionPipelineHealthState {
  const base = state ?? emptyEditionPipelineHealthState();
  return {
    ...base,
    reports: [...base.reports, report],
    latest: report,
  };
}

export function formatEditionPipelineHealthReport(report: EditionPipelineHealthReport): string {
  const lines: string[] = [
    "Edition Health",
    "-------------",
    `Overall: ${report.healthScore}/100`,
    "",
    "Generation",
    report.sections.generation.ok ? "✓ Completed" : "✗ Incomplete",
    "",
    "Validation",
    report.sections.validation.ok
      ? `✓ ${report.validationStatus ?? report.sections.validation.label}`
      : `✗ ${report.sections.validation.label}`,
    "",
    "Repairs",
    report.sections.repairs.ok
      ? `✓ ${report.sections.repairs.label}`
      : `✗ ${report.sections.repairs.label}`,
    "",
    "Publication",
    report.sections.publication.ok
      ? "✓ Published"
      : `✗ ${report.sections.publication.label}`,
  ];

  if (report.warnings.length) {
    lines.push("", "Warnings");
    for (const w of report.warnings) {
      lines.push(`• ${w}`);
    }
  }

  lines.push(
    "",
    "Performance",
    `Generation: ${report.timing.generationMs ?? "n/a"} ms`,
    `Validation: ${report.timing.validationMs ?? "n/a"} ms`,
    `Publish: ${report.timing.publishMs ?? "n/a"} ms`,
    `Total: ${report.timing.totalMs ?? "n/a"} ms`
  );

  return lines.join("\n");
}

export function buildEditionPipelineHealthDiagnostic(
  report: EditionPipelineHealthReport
): Record<string, unknown> {
  return {
    kind: "edition_pipeline_health",
    at: report.recordedAt,
    healthScore: report.healthScore,
    finalPublicationStatus: report.finalPublicationStatus,
    validationStatus: report.validationStatus,
    repairCount: report.repairCount,
    repairedStages: report.repairedStages,
    blockingFailures: report.blockingFailures,
    warnings: report.warnings,
    timing: report.timing,
  };
}
