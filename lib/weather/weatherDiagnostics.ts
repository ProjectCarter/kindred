import type { LiveWeatherSnapshot } from "./liveWeatherRefresh.ts";
import type { HomepageWeatherCondition } from "./conditionDisplay.ts";

export type WeatherRefreshStatus =
  | "idle"
  | "started"
  | "throttled"
  | "success"
  | "invoke_error"
  | "empty_response"
  | "exception";

export type WeatherRefreshDiagnostic = {
  status: WeatherRefreshStatus;
  startedAt: string | null;
  finishedAt: string | null;
  force: boolean;
  coordinates: { lat: number; lon: number; city: string | null } | null;
  httpStatus: number | null;
  provider: string | null;
  retrievedAt: string | null;
  fetchTimestamp: string | null;
  cacheAgeMs: number | null;
  currentC: number | null;
  highC: number | null;
  lowC: number | null;
  conditionCode: number | null;
  weatherSummary: string | null;
  fallbackReason: string | null;
  error: string | null;
};

export type WeatherDisplayDiagnostic = {
  selectedSource: string | null;
  liveRequestStatus: WeatherRefreshStatus;
  coordinates: { lat: number; lon: number; city: string | null } | null;
  fetchedAt: string | null;
  cacheAgeMs: number | null;
  current: string | null;
  highLow: string | null;
  condition: HomepageWeatherCondition | null;
  fallbackReason: string | null;
  lastRefresh: WeatherRefreshDiagnostic | null;
  liveSnapshot: LiveWeatherSnapshot | null;
};

export function emptyWeatherRefreshDiagnostic(): WeatherRefreshDiagnostic {
  return {
    status: "idle",
    startedAt: null,
    finishedAt: null,
    force: false,
    coordinates: null,
    httpStatus: null,
    provider: null,
    retrievedAt: null,
    fetchTimestamp: null,
    cacheAgeMs: null,
    currentC: null,
    highC: null,
    lowC: null,
    conditionCode: null,
    weatherSummary: null,
    fallbackReason: null,
    error: null,
  };
}

let lastWeatherRefreshDiagnostic: WeatherRefreshDiagnostic =
  emptyWeatherRefreshDiagnostic();

export function getLastWeatherRefreshDiagnostic(): WeatherRefreshDiagnostic {
  return lastWeatherRefreshDiagnostic;
}

export function recordWeatherRefreshDiagnostic(
  diagnostic: WeatherRefreshDiagnostic
): void {
  lastWeatherRefreshDiagnostic = diagnostic;
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.log("[home:weather:refresh]", diagnostic);
  }
}
