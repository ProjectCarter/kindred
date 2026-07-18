/**
 * Pure market-build engine helpers — shared by orchestrator script and edge functions.
 */

export const MARKET_BUILD_PHASES = [
  "preflight",
  "events",
  "activities",
  "food_drinks",
  "reconcile",
  "validate",
  "finalize",
] as const;

export type MarketBuildPhase = (typeof MARKET_BUILD_PHASES)[number];

export const MARKET_CATALOG_DESKS = ["events", "activities", "food_drinks"] as const;
export type MarketCatalogDesk = (typeof MARKET_CATALOG_DESKS)[number];

export const PHASE_MAX_ATTEMPTS = 3;
export const PHASE_RETRY_WAIT_MS = 30_000;
export const CATALOG_BATCH_UPSERT_SIZE = 75;
export const ACTIVITY_CATEGORY_CONCURRENCY = 4;
export const STALE_LOCK_GRACE_MS = 60_000;

/** Validation thresholds — must match marketCompleteness.ts */
export const BOOTSTRAP_MIN_EVENTS = 5;
export const BOOTSTRAP_MIN_ACTIVITIES = 12;
export const BOOTSTRAP_MIN_FOOD = 8;

export type WorkerExitReason =
  | "success"
  | "resource_limit"
  | "gateway_timeout"
  | "http_504"
  | "http_546"
  | "build_in_progress"
  | "error";

export function classifyWorkerExit(
  httpStatus: number | null | undefined,
  body: unknown
): WorkerExitReason {
  const text =
    typeof body === "object" && body !== null
      ? JSON.stringify(body)
      : String(body ?? "");

  if (httpStatus === 546) return "http_546";
  if (httpStatus === 504) return "http_504";

  if (/WORKER_RESOURCE_LIMIT/i.test(text)) return "resource_limit";
  if (/gateway.?timeout|504|timed out/i.test(text)) return "gateway_timeout";

  if (httpStatus != null && httpStatus >= 200 && httpStatus < 300) {
    return "success";
  }

  return "error";
}

export function isRetriableWorkerExit(reason: WorkerExitReason): boolean {
  return (
    reason === "resource_limit" ||
    reason === "gateway_timeout" ||
    reason === "http_504" ||
    reason === "http_546"
  );
}

export function phaseToCatalog(phase: MarketBuildPhase): MarketCatalogDesk | null {
  if (phase === "events") return "events";
  if (phase === "activities") return "activities";
  if (phase === "food_drinks") return "food_drinks";
  return null;
}

export function catalogBootstrapThreshold(catalog: MarketCatalogDesk): number {
  switch (catalog) {
    case "events":
      return BOOTSTRAP_MIN_EVENTS;
    case "activities":
      return BOOTSTRAP_MIN_ACTIVITIES;
    case "food_drinks":
      return BOOTSTRAP_MIN_FOOD;
  }
}

export type BootstrapReconcileInput = {
  catalog: MarketCatalogDesk;
  rowCount: number;
  bootstrapComplete: boolean;
  phaseCheckpointComplete: boolean;
  allCategoryCheckpointsComplete: boolean;
};

/** Whether bootstrap flag may be set from persisted rows (never lowers thresholds). */
export function shouldReconcileBootstrap(input: BootstrapReconcileInput): boolean {
  if (input.bootstrapComplete) return false;
  const threshold = catalogBootstrapThreshold(input.catalog);
  if (input.rowCount < threshold) return false;
  if (input.catalog === "activities") {
    return input.allCategoryCheckpointsComplete || input.phaseCheckpointComplete;
  }
  return input.phaseCheckpointComplete || input.rowCount >= threshold;
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
