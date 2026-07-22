/**
 * Edition Pipeline V2 — publish_edition stage (Phase 1).
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { assessPersistedEditionRow } from "../editionCompleteness.ts";
import {
  isPublicationEligible,
  type TechnicalValidationReport,
} from "./technicalValidation.ts";
import {
  mergeValidationIntoBuildState,
  readValidationFromBuildState,
  type EditionBuildValidationState,
} from "./editionValidationTypes.ts";
import { isEditionEarlyPaintEnabled } from "./earlyPaintFeature.ts";
import { logEditionBuildOutcome } from "./editionBuildOutcome.ts";

export type PublishEditionInput = {
  jobId: string;
  editionId: string;
  userId: string;
  editionDate: string;
  metroKey: string;
  traceId: string | null;
  buildState: Record<string, unknown> | null;
  validationReport: TechnicalValidationReport;
};

export type PublishEditionResult =
  | { ok: true; preservedValidation: EditionBuildValidationState }
  | { ok: false; error: string };

export async function runPublishEditionStage(
  admin: SupabaseClient,
  input: PublishEditionInput
): Promise<PublishEditionResult> {
  const report = input.validationReport;

  if (!isPublicationEligible(report)) {
    const error = `publish blocked: technical validation ${report.overallStatus} — ${report.blockingFailures.join(", ")}`;
    return { ok: false, error };
  }

  const finalCompleteness = await assessPersistedEditionRow(admin, input.editionId);
  if (!finalCompleteness.complete) {
    const error = `publish blocked: completeness — ${finalCompleteness.reasons.join(", ")}`;
    return { ok: false, error };
  }

  const prevValidation = readValidationFromBuildState(input.buildState);
  const preservedValidation: EditionBuildValidationState = {
    ...(prevValidation ?? {
      version: report.version,
      earlyPaintEnabled: isEditionEarlyPaintEnabled(),
      technicalValidationAttempts: 0,
      repairAttempts: {},
      latestReport: null,
      reportsByAttempt: [],
      publicationDecision: { allowed: false, at: null, reason: null },
      optionalStageFailures: [],
    }),
    latestReport: report,
    reportsByAttempt: [...(prevValidation?.reportsByAttempt ?? []), report],
    publicationDecision: {
      allowed: true,
      at: new Date().toISOString(),
      reason: null,
    },
  };

  const { error: editionError } = await admin
    .from("editions")
    .update({ status: "ready" })
    .eq("id", input.editionId);

  if (editionError) {
    return { ok: false, error: editionError.message };
  }

  await admin
    .from("generation_jobs")
    .update({
      build_state: mergeValidationIntoBuildState(input.buildState, preservedValidation),
      build_stage: null,
    })
    .eq("id", input.jobId);

  logEditionBuildOutcome({
    kind: "edition_build_outcome",
    at: new Date().toISOString(),
    editionId: input.editionId,
    userId: input.userId,
    jobId: input.jobId,
    metroKey: input.metroKey,
    traceId: input.traceId,
    status: "ready",
    completeness: {
      complete: finalCompleteness.complete,
      reasons: finalCompleteness.reasons,
    },
  });

  console.log(
    JSON.stringify({
      kind: "edition_publish_edition",
      editionId: input.editionId,
      metroKey: input.metroKey,
      traceId: input.traceId,
      validationStatus: report.overallStatus,
      earlyPaintEnabled: isEditionEarlyPaintEnabled(),
      publicationAllowed: true,
    })
  );

  return { ok: true, preservedValidation };
}

export function readLatestValidationReport(
  buildState: Record<string, unknown> | null | undefined
): TechnicalValidationReport | null {
  return readValidationFromBuildState(buildState)?.latestReport ?? null;
}
