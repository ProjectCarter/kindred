import type { AnalyticsContext } from "./types";

let globalContext: AnalyticsContext = {};

export function setAnalyticsContext(partial: AnalyticsContext): void {
  globalContext = {
    ...globalContext,
    ...partial,
  };
}

export function getAnalyticsContext(): AnalyticsContext {
  return globalContext;
}

export function clearAnalyticsEditionContext(): void {
  globalContext = {
    ...globalContext,
    edition_date: null,
  };
}
