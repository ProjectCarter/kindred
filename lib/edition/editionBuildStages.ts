/**
 * Staged edition build — one Edge Function invocation per stage.
 * Shared between client diagnostics and server stage machine.
 */

export const EDITION_BUILD_STAGES = [
  "initialize_edition",
  "generate_national_daily",
  "attach_national_daily",
  "weather",
  "local_events",
  "activities",
  "food_drinks",
  "story_of",
  "local_news",
  "bandits_pick",
  "finalize_edition",
] as const;

export type EditionBuildStage = (typeof EDITION_BUILD_STAGES)[number];

/** Stages that may fail without blocking a paintable edition. */
export const OPTIONAL_EDITION_BUILD_STAGES: ReadonlySet<EditionBuildStage> = new Set([
  "activities",
  "food_drinks",
  "bandits_pick",
  "local_news",
]);

export type EditionBuildStageDiagnostic = {
  traceId: string | null;
  stage: EditionBuildStage;
  elapsedMs: number;
  itemCount: number | null;
  payloadBytes: number | null;
  success: boolean;
  failure: string | null;
  retryCount: number;
  at: string;
};

export function nextEditionBuildStage(
  current: EditionBuildStage | null | undefined
): EditionBuildStage | null {
  if (!current) return EDITION_BUILD_STAGES[0] ?? null;
  const idx = EDITION_BUILD_STAGES.indexOf(current);
  if (idx < 0) return EDITION_BUILD_STAGES[0] ?? null;
  return EDITION_BUILD_STAGES[idx + 1] ?? null;
}

export function isEditionBuildStage(value: string): value is EditionBuildStage {
  return (EDITION_BUILD_STAGES as readonly string[]).includes(value);
}

export function stageIndex(stage: EditionBuildStage): number {
  return EDITION_BUILD_STAGES.indexOf(stage);
}

export function isStageComplete(
  completedStages: readonly string[] | null | undefined,
  stage: EditionBuildStage
): boolean {
  return (completedStages ?? []).includes(stage);
}

export function parseEditionBuildStage(
  value: string | null | undefined
): EditionBuildStage | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  return isEditionBuildStage(trimmed) ? trimmed : null;
}
