import { trackEvent } from "./trackEvent";

let activeLoadId = 0;
let activeLoadStartedAt: number | null = null;

export function beginEditionLoadTracking(): number {
  activeLoadId += 1;
  activeLoadStartedAt = Date.now();
  trackEvent("edition_load_started");
  return activeLoadId;
}

function loadDurationMs(): number | null {
  if (activeLoadStartedAt == null) return null;
  return Date.now() - activeLoadStartedAt;
}

export function completeEditionLoadSuccess(loadId: number): void {
  if (loadId !== activeLoadId || activeLoadStartedAt === null) return;
  trackEvent("edition_load_succeeded", {
    load_duration_ms: loadDurationMs(),
  });
  activeLoadStartedAt = null;
  activeLoadId += 1;
}

export function completeEditionLoadFailure(
  loadId: number,
  errorCode: string
): void {
  if (loadId !== activeLoadId || activeLoadStartedAt === null) return;
  trackEvent("edition_load_failed", {
    error_code: errorCode,
    load_duration_ms: loadDurationMs(),
  });
  activeLoadStartedAt = null;
  activeLoadId += 1;
}
