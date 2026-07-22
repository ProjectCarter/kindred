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
  type SectionRepairPlan,
  type TechnicalValidationReport,
} from "./editionValidationTypes.ts";
import { isEditionEarlyPaintEnabled } from "./earlyPaintFeature.ts";
import {
  applyRepairPlanToValidationState,
  applyUnresolvedRepairToValidationState,
} from "../../../../lib/edition/sectionRepair.ts";

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

export function buildSectionRepairDiagnostic(input: {
  traceId: string | null;
  plan: SectionRepairPlan;
  report: TechnicalValidationReport;
  requeued: boolean;
}): Record<string, unknown> {
  return {
    kind: "edition_section_repair_diagnostic",
    traceId: input.traceId,
    at: new Date().toISOString(),
    requeued: input.requeued,
    plannedStages: input.plan.stages,
    stageReasons: input.plan.stageReasons,
    desksTargeted: input.plan.desksTargeted,
    skippedStages: input.plan.skippedStages,
    unresolvedReason: input.plan.unresolvedReason ?? null,
    validationStatus: input.report.overallStatus,
    blockingFailures: input.report.blockingFailures,
    repairAttemptsAfterPlan: null,
  };
}

export async function appendJobStageDiagnostic(
  admin: SupabaseClient,
  input: { jobId: string; diagnostic: Record<string, unknown> }
): Promise<void> {
  const { data: job } = await admin
    .from("generation_jobs")
    .select("stage_diagnostics")
    .eq("id", input.jobId)
    .maybeSingle();
  const prev = Array.isArray(job?.stage_diagnostics) ? job.stage_diagnostics : [];
  await admin
    .from("generation_jobs")
    .update({
      stage_diagnostics: [...prev, input.diagnostic],
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.jobId);
}

export async function persistRepairPlan(
  admin: SupabaseClient,
  input: {
    jobId: string;
    buildState: Record<string, unknown> | null | undefined;
    plan: SectionRepairPlan;
    report: TechnicalValidationReport;
  }
): Promise<Record<string, unknown>> {
  const prev =
    readValidationFromBuildState(input.buildState) ??
    emptyEditionBuildValidationState(isEditionEarlyPaintEnabled());

  const next = applyRepairPlanToValidationState(prev, input.plan, input.report);
  const merged = mergeValidationIntoBuildState(input.buildState, next);
  await admin
    .from("generation_jobs")
    .update({ build_state: merged })
    .eq("id", input.jobId);
  return merged;
}

export async function persistUnresolvedRepair(
  admin: SupabaseClient,
  input: {
    jobId: string;
    buildState: Record<string, unknown> | null | undefined;
    plan: SectionRepairPlan;
    report: TechnicalValidationReport;
  }
): Promise<Record<string, unknown>> {
  const prev =
    readValidationFromBuildState(input.buildState) ??
    emptyEditionBuildValidationState(isEditionEarlyPaintEnabled());

  const next = applyUnresolvedRepairToValidationState(prev, input.plan, input.report);
  const merged = mergeValidationIntoBuildState(input.buildState, next);
  await admin
    .from("generation_jobs")
    .update({ build_state: merged })
    .eq("id", input.jobId);
  return merged;
}
