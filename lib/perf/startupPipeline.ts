/**
 * Stage-by-stage startup pipeline timing — dev-only, zero production overhead.
 * Complements [perf:startup] marks with per-step durations inside loadEdition.
 */

export type StartupPipelineStage =
  | "cache_load"
  | "edition_lookup"
  | "edition_sections"
  | "normalization"
  | "completeness"
  | "first_paint"
  | "background_sync";

const stageStarts = new Map<string, number>();
const stageDurations: Array<{ stage: string; ms: number }> = [];

export function resetStartupPipelineForTests(): void {
  stageStarts.clear();
  stageDurations.length = 0;
}

export function pipelineStageBegin(
  stage: StartupPipelineStage | string,
  meta?: Record<string, unknown>
): void {
  if (!__DEV__) return;
  stageStarts.set(stage, Date.now());
  console.log(`[perf:pipeline] BEGIN ${stage}`, meta ?? {});
}

export function pipelineStageEnd(
  stage: StartupPipelineStage | string,
  meta?: Record<string, unknown>
): void {
  if (!__DEV__) return;
  const started = stageStarts.get(stage);
  const ms = started != null ? Date.now() - started : null;
  if (ms != null) {
    stageDurations.push({ stage, ms });
    stageStarts.delete(stage);
  }
  console.log(`[perf:pipeline] END ${stage}`, { ms, ...(meta ?? {}) });
}

/** Log ordered summary after first paint or refresh completes. */
export function reportStartupPipeline(context: string): void {
  if (!__DEV__ || stageDurations.length === 0) return;
  const total = stageDurations.reduce((sum, s) => sum + s.ms, 0);
  const slowest = [...stageDurations].sort((a, b) => b.ms - a.ms)[0];
  console.log(`[perf:pipeline] SUMMARY ${context}`, {
    stages: stageDurations,
    totalMs: total,
    slowest: slowest ?? null,
  });
}

export function getStartupPipelineDurations(): ReadonlyArray<{
  stage: string;
  ms: number;
}> {
  return stageDurations;
}
