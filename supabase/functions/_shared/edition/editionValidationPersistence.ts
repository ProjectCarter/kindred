/**
 * Persist edition validation results into generation_jobs.build_state.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  emptyEditionBuildValidationState,
  mergeValidationIntoBuildState,
  readValidationFromBuildState,
  type EditionBuildValidationState,
  type OptionalStageFailureRecord,
  type TechnicalValidationReport,
} from "./editionValidationTypes.ts";
import { isEditionEarlyPaintEnabled } from "./earlyPaintFeature.ts";

export async function persistValidationReport(
  admin: SupabaseClient,
  input: {
    jobId: string;
    buildState: Record<string, unknown> | null | undefined;
    report: TechnicalValidationReport;
  }
): Promise<Record<string, unknown>> {
  const prev = readValidationFromBuildState(input.buildState) ??
    emptyEditionBuildValidationState(isEditionEarlyPaintEnabled());

  const next: EditionBuildValidationState = {
    ...prev,
    earlyPaintEnabled: isEditionEarlyPaintEnabled(),
    technicalValidationAttempts: prev.technicalValidationAttempts + 1,
    latestReport: input.report,
    reportsByAttempt: [...prev.reportsByAttempt, input.report],
  };

  const merged = mergeValidationIntoBuildState(input.buildState, next);
  await admin
    .from("generation_jobs")
    .update({ build_state: merged })
    .eq("id", input.jobId);

  return merged;
}

export async function recordOptionalStageFailure(
  admin: SupabaseClient,
  input: {
    jobId: string;
    buildState: Record<string, unknown> | null | undefined;
    record: OptionalStageFailureRecord;
  }
): Promise<Record<string, unknown>> {
  const prev = readValidationFromBuildState(input.buildState) ??
    emptyEditionBuildValidationState(isEditionEarlyPaintEnabled());

  const next: EditionBuildValidationState = {
    ...prev,
    optionalStageFailures: [...prev.optionalStageFailures, input.record],
  };

  const merged = mergeValidationIntoBuildState(input.buildState, next);
  await admin
    .from("generation_jobs")
    .update({ build_state: merged })
    .eq("id", input.jobId);

  return merged;
}

export function buildValidationStageDiagnostic(input: {
  traceId: string | null;
  report: TechnicalValidationReport;
  publicationAllowed: boolean;
}): Record<string, unknown> {
  return {
    kind: "edition_validation_diagnostic",
    traceId: input.traceId,
    at: new Date().toISOString(),
    validationVersion: input.report.version,
    overallResult: input.report.overallStatus,
    enforcing: input.report.enforcing,
    durationMs: input.report.durationMs,
    deskStatuses: input.report.deskReports.map((d) => ({
      desk: d.desk,
      status: d.status,
    })),
    blockingFailures: input.report.blockingFailures,
    warnings: input.report.warnings,
    publicationAllowed: input.publicationAllowed,
    earlyPaintEnabled: isEditionEarlyPaintEnabled(),
    externalChecks: input.report.externalChecks,
  };
}
