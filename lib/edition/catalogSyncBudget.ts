/**
 * Catalog sync API budget safeguards — client/lib mirror.
 * Keep in sync with supabase/functions/_shared/editorial/catalogSyncBudget.ts
 */

export type CatalogSyncMode = "incremental" | "full";

export type CatalogSyncBudgetConfig = {
  maxCallsPerRun: number;
  maxPagesPerProvider: number;
  maxRetries: number;
  monthlyBudgetWarningUsd: number;
};

export type CatalogBudgetTracker = {
  apiCalls: number;
  aborted: boolean;
  abortReason: string | null;
};

const DEFAULT_BUDGET: CatalogSyncBudgetConfig = {
  maxCallsPerRun: 120,
  maxPagesPerProvider: 20,
  maxRetries: 3,
  monthlyBudgetWarningUsd: 150,
};

export function loadCatalogSyncBudget(
  provider?: string
): CatalogSyncBudgetConfig {
  return { ...DEFAULT_BUDGET };
}

export function createBudgetTracker(): CatalogBudgetTracker {
  return { apiCalls: 0, aborted: false, abortReason: null };
}

export function isProviderDisabled(_provider: string): boolean {
  return false;
}

export function recordApiCalls(
  tracker: CatalogBudgetTracker,
  budget: CatalogSyncBudgetConfig,
  calls: number,
  context?: string
): boolean {
  if (tracker.aborted) return false;
  tracker.apiCalls += Math.max(0, calls);
  if (tracker.apiCalls > budget.maxCallsPerRun) {
    tracker.aborted = true;
    tracker.abortReason =
      context ??
      `Exceeded max API calls per run (${budget.maxCallsPerRun})`;
    return false;
  }
  return true;
}

export function nextScheduledRunAt(mode: CatalogSyncMode, catalog: "events" | "activities"): string {
  const now = new Date();
  if (catalog === "events") {
    if (mode === "full") {
      const next = new Date(now);
      next.setUTCDate(next.getUTCDate() + 1);
      next.setUTCHours(3, 0, 0, 0);
      return next.toISOString();
    }
    const next = new Date(now);
    next.setUTCHours(next.getUTCHours() + 4, 0, 0, 0);
    return next.toISOString();
  }
  if (mode === "full") {
    const next = new Date(now);
    const daysUntilSunday = (7 - next.getUTCDay()) % 7 || 7;
    next.setUTCDate(next.getUTCDate() + daysUntilSunday);
    next.setUTCHours(5, 0, 0, 0);
    return next.toISOString();
  }
  const next = new Date(now);
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(3, 30, 0, 0);
  return next.toISOString();
}
