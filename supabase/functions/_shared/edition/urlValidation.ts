/**
 * Bounded URL structure checks and optional HEAD probes for edition validation.
 * No full body downloads; transient failures become WARNING when structurally valid.
 */

export type UrlProbeResult = {
  url: string;
  structurallyValid: boolean;
  probed: boolean;
  status: "PASS" | "WARNING" | "FAIL";
  httpStatus: number | null;
  message?: string;
};

const HEAD_TIMEOUT_MS = 2000;
const MAX_CONCURRENT_HEAD = 4;

export function isStructurallyValidHttpUrl(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isTransientHeadFailure(status: number | null, err?: string): boolean {
  if (err?.includes("timeout") || err?.includes("Timed out")) return true;
  if (status === 403 || status === 429 || status === 503) return true;
  return false;
}

async function probeHead(url: string): Promise<UrlProbeResult> {
  if (!isStructurallyValidHttpUrl(url)) {
    return {
      url,
      structurallyValid: false,
      probed: false,
      status: "FAIL",
      httpStatus: null,
      message: "malformed_url",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEAD_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok || res.status === 405) {
      return {
        url,
        structurallyValid: true,
        probed: true,
        status: "PASS",
        httpStatus: res.status,
      };
    }
    if (isTransientHeadFailure(res.status)) {
      return {
        url,
        structurallyValid: true,
        probed: true,
        status: "WARNING",
        httpStatus: res.status,
        message: "transient_head_failure",
      };
    }
    return {
      url,
      structurallyValid: true,
      probed: true,
      status: "FAIL",
      httpStatus: res.status,
      message: `http_${res.status}`,
    };
  } catch (err) {
    clearTimeout(timer);
    const message = err instanceof Error ? err.message : String(err);
    if (isTransientHeadFailure(null, message)) {
      return {
        url,
        structurallyValid: true,
        probed: true,
        status: "WARNING",
        httpStatus: null,
        message: "transient_head_failure",
      };
    }
    return {
      url,
      structurallyValid: true,
      probed: true,
      status: "FAIL",
      httpStatus: null,
      message: message.slice(0, 120),
    };
  }
}

/** Probe URLs with strict concurrency — returns aggregate stats + per-URL results. */
export async function probeUrlsBounded(
  urls: string[],
  options?: { required?: boolean }
): Promise<{
  results: UrlProbeResult[];
  attempted: number;
  durationMs: number;
  warnings: number;
  failures: number;
}> {
  const required = options?.required ?? false;
  const unique = [...new Set(urls.filter((u) => u?.trim()))];
  const started = performance.now();
  const results: UrlProbeResult[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < unique.length) {
      const i = index++;
      const url = unique[i]!;
      const result = await probeHead(url);
      if (!result.structurallyValid && required) {
        results.push({ ...result, status: "FAIL" });
        continue;
      }
      results.push(result);
    }
  }

  const workers = Array.from(
    { length: Math.min(MAX_CONCURRENT_HEAD, Math.max(1, unique.length)) },
    () => worker()
  );
  await Promise.all(workers);

  const durationMs = Math.round(performance.now() - started);
  const warnings = results.filter((r) => r.status === "WARNING").length;
  const failures = results.filter((r) => r.status === "FAIL").length;

  return {
    results,
    attempted: results.filter((r) => r.probed).length,
    durationMs,
    warnings,
    failures,
  };
}

export function aggregateUrlProbeStatus(
  results: UrlProbeResult[],
  required: boolean
): DeskUrlAggregate {
  if (!results.length) {
    return required
      ? { status: "FAIL", reasons: ["required_url_missing"] }
      : { status: "PASS", reasons: [] };
  }
  if (results.some((r) => r.status === "FAIL")) {
    return {
      status: "FAIL",
      reasons: results.filter((r) => r.status === "FAIL").map((r) => r.message ?? "url_fail"),
    };
  }
  if (results.some((r) => r.status === "WARNING")) {
    return {
      status: "WARNING",
      reasons: ["transient_url_probe_warning"],
    };
  }
  return { status: "PASS", reasons: [] };
}

export type DeskUrlAggregate = {
  status: "PASS" | "WARNING" | "FAIL";
  reasons: string[];
};

export function isValidLatitude(lat: unknown): boolean {
  return typeof lat === "number" && Number.isFinite(lat) && lat >= -90 && lat <= 90;
}

export function isValidLongitude(lon: unknown): boolean {
  return typeof lon === "number" && Number.isFinite(lon) && lon >= -180 && lon <= 180;
}
