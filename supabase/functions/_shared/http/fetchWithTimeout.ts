/** Fetch with an AbortSignal deadline — prevents hung external calls from consuming Edge budget. */

export class FetchTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`fetch timed out after ${timeoutMs}ms`);
    this.name = "FetchTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export async function fetchWithTimeout(
  input: string | URL | Request,
  init: RequestInit = {},
  timeoutMs = 30_000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: init.signal
        ? mergeAbortSignals(init.signal, controller.signal)
        : controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted && !(init.signal as AbortSignal | undefined)?.aborted) {
      throw new FetchTimeoutError(timeoutMs);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function mergeAbortSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  if (a.aborted || b.aborted) {
    return AbortSignal.abort(a.reason ?? b.reason);
  }
  const controller = new AbortController();
  const abort = () => controller.abort(a.reason ?? b.reason);
  a.addEventListener("abort", abort, { once: true });
  b.addEventListener("abort", abort, { once: true });
  return controller.signal;
}
