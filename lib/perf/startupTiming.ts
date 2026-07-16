/**
 * Cold-start performance marks — dev-only timeline for verifying the 5s target.
 * Call markStartup() at each pipeline stage; logStartupSummary() at first paint.
 */

const startMs = Date.now();
const marks: Array<{ name: string; elapsedMs: number }> = [];

export function markStartup(name: string): void {
  const elapsedMs = Date.now() - startMs;
  marks.push({ name, elapsedMs });
  if (__DEV__) {
    console.log(`[perf:startup] ${name} +${elapsedMs}ms`);
  }
}

export function logStartupSummary(
  context?: string,
  options?: { editionComplete?: boolean }
): void {
  const elapsedMs = startupElapsedMs();
  const label = context ? ` (${context})` : "";
  const overBudget = elapsedMs > 5000;
  const incomplete = options?.editionComplete === false;

  if (__DEV__ && marks.length > 0) {
    console.log(`[perf:startup] timeline${label}`, marks);
  }

  // Always surface budget violations — V1 requires measured verification.
  if (overBudget) {
    console.warn(
      `[perf:startup] OVER BUDGET${label}: ${elapsedMs}ms (max 5000ms)`,
      __DEV__ ? marks : undefined
    );
  } else if (incomplete) {
    // Fast first paint of a partial paper is not Phase One success.
    console.warn(
      `[perf:startup] FAST BUT INCOMPLETE${label}: ${elapsedMs}ms — full edition missing desks`
    );
  } else if (__DEV__) {
    console.log(`[perf:startup] within budget${label}: ${elapsedMs}ms`);
  }
}

export function startupElapsedMs(): number {
  return Date.now() - startMs;
}
