/** End-to-end dev edition generate trace — __DEV__ only, zero production cost. */

export type DevGenerateStage =
  | "tap_queued"
  | "home_focus_consume_pending"
  | "handle_generate_enter"
  | "dev_cache_clear"
  | "location_resolve_start"
  | "location_resolve_end"
  | "invoke_prepare"
  | "invoke_start"
  | "invoke_end"
  | "async_poll_start"
  | "async_poll_tick"
  | "async_poll_end"
  | "background_poll_tick"
  | "background_poll_ready"
  | "manual_build_start"
  | "generation_stalled"
  | "partial_edition_paint"
  | "generating_first_paint_timeout"
  | "first_paint"
  | "load_edition_start"
  | "load_edition_end"
  | "generating_cleared"
  | "handle_generate_exit"
  | "load_edition_blocked"
  | "load_edition_fetch_start"
  | "load_edition_fetch_end";

type TraceMark = { stage: DevGenerateStage; at: number; meta?: Record<string, unknown> };

const activeTraces = new Map<string, TraceMark[]>();

export function createDevGenerateTraceId(): string {
  return `dg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function devGenerateTrace(
  traceId: string | null | undefined,
  stage: DevGenerateStage,
  meta?: Record<string, unknown>
): void {
  if (!__DEV__ || !traceId) return;
  const at = Date.now();
  const marks = activeTraces.get(traceId) ?? [];
  marks.push({ stage, at, meta });
  activeTraces.set(traceId, marks);
  const origin = marks[0]?.at ?? at;
  console.log(`[devgen:${traceId}] ${stage}`, {
    elapsedMs: at - origin,
    sincePrevMs: marks.length > 1 ? at - marks[marks.length - 2]!.at : 0,
    ...meta,
  });
}

export function devGenerateTraceSummary(traceId: string | null | undefined): void {
  if (!__DEV__ || !traceId) return;
  const marks = activeTraces.get(traceId);
  if (!marks?.length) return;
  const origin = marks[0]!.at;
  const end = marks[marks.length - 1]!.at;
  console.log(`[devgen:${traceId}] SUMMARY`, {
    totalMs: end - origin,
    stages: marks.map((m) => ({
      stage: m.stage,
      elapsedMs: m.at - origin,
      ...m.meta,
    })),
  });
  activeTraces.delete(traceId);
}

export function resetDevGenerateTracesForTests(): void {
  activeTraces.clear();
}
