/**
 * Persist Edition Quality Engine reports into generation_jobs.build_state (append-only).
 * Non-blocking — never gates publication.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  appendEditionQualityReport,
  buildEditionQualityDiagnostic,
  evaluateEditionQuality,
  formatEditionQualityReport,
  mergeEditionQualityIntoBuildState,
  readEditionQualityFromBuildState,
  type EditionQualityInput,
  type EditionQualityLocation,
} from "../../../../lib/edition/editionQualityEngine.ts";
import { loadEditionValidationSnapshot } from "./technicalValidation.ts";
import { appendJobStageDiagnostic } from "./editionValidationPersistence.ts";

export function buildEditionQualityInputFromSnapshot(input: {
  snapshot: NonNullable<Awaited<ReturnType<typeof loadEditionValidationSnapshot>>>;
  location: EditionQualityLocation;
  catalogMetroKey?: string;
  traceId?: string | null;
}): EditionQualityInput {
  const { snapshot } = input;
  const morningHero =
    snapshot.morningEdition &&
    typeof snapshot.morningEdition === "object" &&
    "morningHero" in snapshot.morningEdition
      ? (snapshot.morningEdition as { morningHero?: EditionQualityInput["morningHero"] }).morningHero ??
        null
      : null;

  return {
    editionId: snapshot.editionId,
    metroKey: snapshot.metroKey,
    editionDate: snapshot.editionDate,
    location: input.location,
    sections: snapshot.sections as EditionQualityInput["sections"],
    leadStory: snapshot.leadStory,
    nationalNews: snapshot.nationalNews as EditionQualityInput["nationalNews"],
    bandit: snapshot.bandit,
    discovery: snapshot.discovery,
    morningHero,
    usNationalDailyId: snapshot.usNationalDailyId,
    editorialContext: snapshot.editorialContext,
    historyAroundTown: snapshot.historyAroundTown,
    expectStoryOf: snapshot.expectStoryOf,
    traceId: input.traceId ?? null,
  };
}

export async function recordEditionQuality(
  admin: SupabaseClient,
  input: {
    jobId: string;
    buildState: Record<string, unknown>;
    editionId: string;
    userId: string;
    editionDate: string;
    metroKey: string;
    traceId: string | null;
    location: EditionQualityLocation;
    catalogMetroKey?: string;
  }
): Promise<Record<string, unknown>> {
  const snapshot = await loadEditionValidationSnapshot(admin, {
    editionId: input.editionId,
    editionDate: input.editionDate,
    metroKey: input.metroKey,
    userId: input.userId,
  });

  if (!snapshot) {
    console.warn(
      `[editionQuality] snapshot unavailable for ${input.metroKey} — skipping quality record`
    );
    return input.buildState;
  }

  const qualityInput = buildEditionQualityInputFromSnapshot({
    snapshot,
    location: input.location,
    catalogMetroKey: input.catalogMetroKey,
    traceId: input.traceId,
  });

  const report = evaluateEditionQuality(qualityInput);
  const prev = readEditionQualityFromBuildState(input.buildState);
  const next = appendEditionQualityReport(prev, report);
  const merged = mergeEditionQualityIntoBuildState(input.buildState, next);

  await admin.from("generation_jobs").update({ build_state: merged }).eq("id", input.jobId);

  await appendJobStageDiagnostic(admin, {
    jobId: input.jobId,
    diagnostic: buildEditionQualityDiagnostic(report),
  });

  console.log(
    `[perf:metrics] edition_quality ${report.metroKey} score=${report.overallScore} tier=${report.tier} ms=${report.durationMs}`
  );
  console.log(formatEditionQualityReport(report));

  return merged;
}
