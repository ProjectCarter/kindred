/**
 * Catalog sync API budget safeguards — shared by Events, Activities, Food & Drink.
 * Server mirror — keep in sync with lib/edition/catalogSyncBudget.ts
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

const PROVIDER_ENV_PREFIX: Record<string, string> = {
  foursquare: "FOURSQUARE",
  ticketmaster: "TICKETMASTER",
  serp_google_events: "SERP_EVENTS",
  eventbrite: "EVENTBRITE",
  nps_park_events: "NPS_EVENTS",
};

export function loadCatalogSyncBudget(
  provider?: string
): CatalogSyncBudgetConfig {
  const prefix = provider ? PROVIDER_ENV_PREFIX[provider] ?? provider.toUpperCase() : "CATALOG";
  const env = (key: string, fallback: number) => {
    const raw = Deno.env.get(`${prefix}_${key}`);
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  return {
    maxCallsPerRun: env("MAX_CALLS_PER_RUN", DEFAULT_BUDGET.maxCallsPerRun),
    maxPagesPerProvider: env("MAX_PAGES", DEFAULT_BUDGET.maxPagesPerProvider),
    maxRetries: env("MAX_RETRIES", DEFAULT_BUDGET.maxRetries),
    monthlyBudgetWarningUsd: env(
      "MONTHLY_BUDGET_WARNING_USD",
      DEFAULT_BUDGET.monthlyBudgetWarningUsd
    ),
  };
}

export function createBudgetTracker(): CatalogBudgetTracker {
  return { apiCalls: 0, aborted: false, abortReason: null };
}

export function isProviderDisabled(provider: string): boolean {
  const prefix = PROVIDER_ENV_PREFIX[provider] ?? provider.toUpperCase();
  const flag = Deno.env.get(`${prefix}_DISABLED`) ?? Deno.env.get(`CATALOG_${prefix}_DISABLED`);
  return flag === "1" || flag === "true";
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
    console.warn("[catalog:budget] run aborted", {
      apiCalls: tracker.apiCalls,
      max: budget.maxCallsPerRun,
      reason: tracker.abortReason,
    });
    return false;
  }
  return true;
}

export function estimatedSerpApiCostPerCall(): number {
  return 0.002;
}

export function estimatedTicketmasterCostPerCall(): number {
  return 0;
}

export function estimatedFoursquareCostPerCall(): number {
  return 0.001;
}

export function estimateProviderCallCost(provider: string): number {
  switch (provider) {
    case "serp_google_events":
      return estimatedSerpApiCostPerCall();
    case "foursquare":
      return estimatedFoursquareCostPerCall();
    case "ticketmaster":
      return estimatedTicketmasterCostPerCall();
    default:
      return 0;
  }
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
