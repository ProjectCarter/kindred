/**
 * Structured per-stage build diagnostics.
 */

import type { EditionBuildStageDiagnostic } from "./editionBuildStages.ts";

export function logEditionBuildStageDiagnostic(
  diagnostic: EditionBuildStageDiagnostic
): void {
  console.log(
    JSON.stringify({
      kind: "edition_build_stage",
      ...diagnostic,
    })
  );
}

export function buildStageDiagnostic(input: {
  traceId: string | null;
  stage: EditionBuildStageDiagnostic["stage"];
  elapsedMs: number;
  itemCount?: number | null;
  payloadBytes?: number | null;
  success: boolean;
  failure?: string | null;
  retryCount?: number;
}): EditionBuildStageDiagnostic {
  return {
    traceId: input.traceId,
    stage: input.stage,
    elapsedMs: input.elapsedMs,
    itemCount: input.itemCount ?? null,
    payloadBytes: input.payloadBytes ?? null,
    success: input.success,
    failure: input.failure ?? null,
    retryCount: input.retryCount ?? 0,
    at: new Date().toISOString(),
  };
}
