/**
 * Phase 1 startup metrics — measured, not theoretical.
 * Dev: full report in console. Production: no overhead (counters no-op).
 */

import { startupElapsedMs } from "./startupTiming";

export type StartupLaunchKind = "cold_launch" | "warm_launch" | "unknown";

export type StartupMetricsSnapshot = {
  /** Wall clock from app module load to report time (ms). */
  totalElapsedMs: number;
  /** First meaningful homepage content — cache paint or first full paint. */
  ttfmcMs: number | null;
  ttfmcSource: "home_cache_paint" | "home_first_paint" | null;
  launchKind: StartupLaunchKind;
  cacheHit: boolean;
  /** Supabase REST / realtime HTTP during startup window. */
  supabaseFetchCount: number;
  /** Edge Function HTTP (/functions/v1/) during startup window. */
  edgeFunctionFetchCount: number;
  otherFetchCount: number;
  authGetSessionCount: number;
  authLaunchSessionCacheHitCount: number;
  loadPrefsCallCount: number;
  loadPrefsCacheHitCount: number;
  /** home_fetch_start → home_first_paint or home_cache_paint */
  editionLoadMs: number | null;
  /** editions query complete mark minus fetch start */
  editionsQueryMs: number | null;
  /** sections query complete minus editions query */
  sectionsQueryMs: number | null;
  memoryNote: string | null;
  marks: Array<{ name: string; elapsedMs: number }>;
};

const marks: Array<{ name: string; elapsedMs: number }> = [];

let probeActive = false;
let reported = false;

let supabaseFetchCount = 0;
let edgeFunctionFetchCount = 0;
let otherFetchCount = 0;
let authGetSessionCount = 0;
let authLaunchSessionCacheHitCount = 0;
let loadPrefsCallCount = 0;
let loadPrefsCacheHitCount = 0;

let cacheHit = false;
let launchKind: StartupLaunchKind = "unknown";
let editionFetchStartMs: number | null = null;

export function resetStartupMetricsForTests(): void {
  marks.length = 0;
  probeActive = false;
  reported = false;
  supabaseFetchCount = 0;
  edgeFunctionFetchCount = 0;
  otherFetchCount = 0;
  authGetSessionCount = 0;
  authLaunchSessionCacheHitCount = 0;
  loadPrefsCallCount = 0;
  loadPrefsCacheHitCount = 0;
  cacheHit = false;
  launchKind = "unknown";
  editionFetchStartMs = null;
}

export function beginStartupMetricsProbe(): void {
  if (!__DEV__) return;
  probeActive = true;
}

export function isStartupMetricsProbeActive(): boolean {
  return probeActive && __DEV__;
}

export function endStartupMetricsProbe(): void {
  probeActive = false;
}

export function recordStartupMark(name: string, elapsedMs: number): void {
  if (!__DEV__) return;
  marks.push({ name, elapsedMs });
  if (name === "home_fetch_start") {
    editionFetchStartMs = elapsedMs;
  }
  if (name === "home_cache_paint") {
    cacheHit = true;
  }
}

export function recordAuthGetSession(): void {
  if (!__DEV__) return;
  authGetSessionCount += 1;
}

export function recordLaunchSessionCacheHit(): void {
  if (!__DEV__) return;
  authLaunchSessionCacheHitCount += 1;
}

export function recordLoadPrefsInvocation(cached: boolean): void {
  if (!__DEV__) return;
  loadPrefsCallCount += 1;
  if (cached) loadPrefsCacheHitCount += 1;
}

export function setStartupLaunchKind(kind: StartupLaunchKind): void {
  if (!__DEV__) return;
  launchKind = kind;
}

export function recordStartupFetch(url: string, supabaseHost: string): void {
  if (!probeActive || !__DEV__) return;
  const lower = url.toLowerCase();
  if (lower.includes("/functions/v1/")) {
    edgeFunctionFetchCount += 1;
    return;
  }
  if (supabaseHost && lower.includes(supabaseHost.toLowerCase())) {
    supabaseFetchCount += 1;
    return;
  }
  otherFetchCount += 1;
}

function markMs(name: string): number | null {
  const hit = marks.find((m) => m.name === name);
  return hit?.elapsedMs ?? null;
}

export function buildStartupMetricsSnapshot(): StartupMetricsSnapshot {
  const cachePaint = markMs("home_cache_paint");
  const firstPaint = markMs("home_first_paint");
  const fetchStart = markMs("home_fetch_start");
  const editionsDone = markMs("home_editions_query_done");
  const sectionsDone = markMs("home_sections_query_done");

  let ttfmcMs: number | null = null;
  let ttfmcSource: StartupMetricsSnapshot["ttfmcSource"] = null;
  if (cachePaint != null && (firstPaint == null || cachePaint <= firstPaint)) {
    ttfmcMs = cachePaint;
    ttfmcSource = "home_cache_paint";
  } else if (firstPaint != null) {
    ttfmcMs = firstPaint;
    ttfmcSource = "home_first_paint";
  }

  let editionLoadMs: number | null = null;
  if (fetchStart != null && ttfmcMs != null) {
    editionLoadMs = ttfmcMs - fetchStart;
  }

  let editionsQueryMs: number | null = null;
  if (fetchStart != null && editionsDone != null) {
    editionsQueryMs = editionsDone - fetchStart;
  }

  let sectionsQueryMs: number | null = null;
  if (editionsDone != null && sectionsDone != null) {
    sectionsQueryMs = sectionsDone - editionsDone;
  }

  return {
    totalElapsedMs: startupElapsedMs(),
    ttfmcMs,
    ttfmcSource,
    launchKind,
    cacheHit,
    supabaseFetchCount,
    edgeFunctionFetchCount,
    otherFetchCount,
    authGetSessionCount,
    authLaunchSessionCacheHitCount,
    loadPrefsCallCount,
    loadPrefsCacheHitCount,
    editionLoadMs,
    editionsQueryMs,
    sectionsQueryMs,
    memoryNote:
      typeof (global as { performance?: { memory?: unknown } }).performance
        ?.memory === "object"
        ? "performance.memory unavailable in React Native — use Xcode Instruments / Android Profiler for heap"
        : "Use native profiler for memory on device",
    marks: [...marks],
  };
}

/** Call once at first homepage paint — logs structured metrics in dev. */
export function reportStartupMetrics(context: string): StartupMetricsSnapshot {
  const snapshot = buildStartupMetricsSnapshot();
  if (!__DEV__) return snapshot;
  if (reported) {
    console.log(`[perf:metrics] ${context} (duplicate report skipped)`, snapshot);
    return snapshot;
  }
  reported = true;
  endStartupMetricsProbe();
  console.log(`[perf:metrics] BASELINE_REPORT ${context}`, JSON.stringify(snapshot, null, 2));
  return snapshot;
}
