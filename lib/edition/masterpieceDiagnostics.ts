/**
 * Temporary masterpiece pipeline tracing — remove after hang regression is resolved.
 * Every async step logs BEGIN/END so we can see exactly where execution stops.
 */

const PREFIX = "[masterpiece:trace]";

export function masterpieceTraceBegin(
  step: string,
  meta?: Record<string, unknown>
): void {
  if (!__DEV__) return;
  console.log(`${PREFIX} BEGIN ${step}`, meta ?? {});
}

export function masterpieceTraceEnd(
  step: string,
  meta?: Record<string, unknown>
): void {
  if (!__DEV__) return;
  console.log(`${PREFIX} END ${step}`, meta ?? {});
}

export function masterpieceTraceSync<T>(
  step: string,
  fn: () => T,
  meta?: Record<string, unknown>
): T {
  masterpieceTraceBegin(step, meta);
  const started = Date.now();
  try {
    const value = fn();
    masterpieceTraceEnd(step, { ms: Date.now() - started });
    return value;
  } catch (error) {
    masterpieceTraceEnd(step, {
      ms: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function masterpieceTraceAsync<T>(
  step: string,
  fn: () => Promise<T>,
  meta?: Record<string, unknown>
): Promise<T> {
  masterpieceTraceBegin(step, meta);
  const started = Date.now();
  try {
    const value = await fn();
    masterpieceTraceEnd(step, { ms: Date.now() - started });
    return value;
  } catch (error) {
    masterpieceTraceEnd(step, {
      ms: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
