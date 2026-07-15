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

export function logStartupSummary(context?: string): void {
  if (!__DEV__ || marks.length === 0) return;
  const label = context ? ` (${context})` : "";
  console.log(`[perf:startup] timeline${label}`, marks);
}

export function startupElapsedMs(): number {
  return Date.now() - startMs;
}
