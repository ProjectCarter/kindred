/**
 * Persist Edition Pipeline V2 health reports into generation_jobs.build_state (append-only).
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  appendEditionPipelineHealthReport,
  buildEditionPipelineHealthDiagnostic,
  buildEditionPipelineHealthReport,
  formatEditionPipelineHealthReport,
  mergePipelineHealthIntoBuildState,
  readPipelineHealthFromBuildState,
  readPipelineStageTimings,
  type EditionPipelineHealthPublicationStatus,
} from "../../../../lib/edition/editionPipelineHealth.ts";
import { readValidationFromBuildState } from "./editionValidationTypes.ts";
import { appendJobStageDiagnostic } from "./editionValidationPersistence.ts";

export async function recordEditionPipelineHealth(
  admin: SupabaseClient,
  input: {
    jobId: string;
    buildState: Record<string, unknown>;
    editionId: string;
    metroKey: string;
    editionDate: string;
    traceId: string | null;
    publicationStatus: EditionPipelineHealthPublicationStatus;
  }
): Promise<Record<string, unknown>> {
  const validation = readValidationFromBuildState(input.buildState);
  const stageTimings = readPipelineStageTimings(input.buildState);

  const report = buildEditionPipelineHealthReport({
    editionId: input.editionId,
    metroKey: input.metroKey,
    editionDate: input.editionDate,
    traceId: input.traceId,
    validation,
    stageTimings,
    publicationStatus: input.publicationStatus,
  });

  const prevHealth = readPipelineHealthFromBuildState(input.buildState);
  const nextHealth = appendEditionPipelineHealthReport(prevHealth, report);
  const merged = mergePipelineHealthIntoBuildState(input.buildState, nextHealth);

  await admin
    .from("generation_jobs")
    .update({ build_state: merged })
    .eq("id", input.jobId);

  await appendJobStageDiagnostic(admin, {
    jobId: input.jobId,
    diagnostic: buildEditionPipelineHealthDiagnostic(report),
  });

  console.log(`[perf:pipeline] edition_health ${report.metroKey} score=${report.healthScore}`);
  console.log(formatEditionPipelineHealthReport(report));

  return merged;
}
