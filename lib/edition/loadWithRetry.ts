/**
 * Network fetch helper with timeout and automatic retry — keeps edition
 * loads dependable without leaving the reader on a spinner indefinitely.
 */

const DEFAULT_TIMEOUT_MS = 25_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1_200;

export type LoadAttemptResult<T> =
  | { ok: true; value: T; attempt: number; elapsedMs: number }
  | { ok: false; error: Error; attempt: number; elapsedMs: number };

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      });
  });
}

export async function loadWithRetry<T>(
  fn: () => Promise<T>,
  options?: {
    label?: string;
    timeoutMs?: number;
    maxAttempts?: number;
    onAttempt?: (attempt: number, error?: Error) => void;
  }
): Promise<LoadAttemptResult<T>> {
  const label = options?.label ?? "request";
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const started = Date.now();

  let lastError = new Error(`${label} failed`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    options?.onAttempt?.(attempt);
    try {
      const value = await withTimeout(fn(), timeoutMs, label);
      return {
        ok: true,
        value,
        attempt,
        elapsedMs: Date.now() - started,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      options?.onAttempt?.(attempt, lastError);
      if (__DEV__) {
        console.warn(`[loadWithRetry] ${label} attempt ${attempt} failed`, {
          message: lastError.message,
        });
      }
      if (attempt < maxAttempts) {
        await delay(RETRY_DELAY_MS * attempt);
      }
    }
  }

  return {
    ok: false,
    error: lastError,
    attempt: maxAttempts,
    elapsedMs: Date.now() - started,
  };
}
