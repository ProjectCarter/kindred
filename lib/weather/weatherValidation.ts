/**
 * Weather freshness and consistency gates — reject stale or mismatched data.
 */

import type { KindredWeatherSnapshot } from "./weatherSnapshot.ts";
import type { ParsedWeatherSummary } from "./parseWeatherSummary.ts";
import { weatherConditionFromPhrase } from "./weatherEmojiGuide.ts";
import { weatherConditionKeyFromWmo } from "./weatherEmojiGuide.ts";

/** Max age for homepage display — stale observations are hidden, not shown. */
export const WEATHER_DISPLAY_MAX_AGE_MS = 90 * 60 * 1000;

/** Max age allowed at publication — older forecasts are rejected. */
export const WEATHER_PUBLISH_MAX_AGE_MS = 45 * 60 * 1000;

export type WeatherValidationResult = {
  ok: boolean;
  reasons: string[];
};

function cToF(c: number): number {
  return (c * 9) / 5 + 32;
}

function tempToleranceF(unit: "fahrenheit" | "celsius"): number {
  return unit === "fahrenheit" ? 8 : 4;
}

export function isWeatherFresh(
  retrievedAt: string,
  maxAgeMs: number,
  now = new Date()
): boolean {
  const ts = Date.parse(retrievedAt);
  if (!Number.isFinite(ts)) return false;
  return now.getTime() - ts <= maxAgeMs;
}

export function validateWeatherSnapshot(
  snapshot: KindredWeatherSnapshot,
  options?: {
    maxAgeMs?: number;
    now?: Date;
  }
): WeatherValidationResult {
  const reasons: string[] = [];
  const maxAgeMs = options?.maxAgeMs ?? WEATHER_PUBLISH_MAX_AGE_MS;
  const now = options?.now ?? new Date();

  if (!isWeatherFresh(snapshot.retrievedAt, maxAgeMs, now)) {
    reasons.push("stale_weather_observation");
  }

  if (!Number.isFinite(snapshot.conditionCode)) {
    reasons.push("missing_condition_code");
  }

  if (!Number.isFinite(snapshot.currentTempC)) {
    reasons.push("missing_current_temperature");
  }

  if (
    snapshot.highTempC != null &&
    snapshot.lowTempC != null &&
    snapshot.highTempC < snapshot.lowTempC
  ) {
    reasons.push("high_below_low");
  }

  if (
    snapshot.highTempC != null &&
    snapshot.lowTempC != null &&
    Number.isFinite(snapshot.currentTempC)
  ) {
    const highF = cToF(snapshot.highTempC);
    const lowF = cToF(snapshot.lowTempC);
    const currentF = cToF(snapshot.currentTempC);
    const slack = 6;
    if (currentF > highF + slack || currentF < lowF - slack) {
      reasons.push("current_outside_daily_range");
    }
  }

  return { ok: reasons.length === 0, reasons };
}

export function validateSummaryMatchesSnapshot(
  parsed: ParsedWeatherSummary | null,
  snapshot: KindredWeatherSnapshot
): WeatherValidationResult {
  const reasons: string[] = [];
  if (!parsed?.currentLabel) {
    reasons.push("summary_missing_current");
    return { ok: false, reasons };
  }

  const parsedCurrent = Number(/^(\d+)/.exec(parsed.currentLabel)?.[1]);
  const snapshotCurrent =
    snapshot.unit === "fahrenheit"
      ? Math.round(cToF(snapshot.currentTempC))
      : Math.round(snapshot.currentTempC);

  if (
    Number.isFinite(parsedCurrent) &&
    Math.abs(parsedCurrent - snapshotCurrent) > tempToleranceF(snapshot.unit)
  ) {
    reasons.push("summary_current_mismatch");
  }

  if (parsed.conditionPhrase) {
    const fromPhrase = weatherConditionFromPhrase(parsed.conditionPhrase);
    const fromCode = weatherConditionKeyFromWmo(
      snapshot.conditionCode,
      snapshot.windSpeedMs
    );
    if (fromPhrase && fromCode && fromPhrase.key !== fromCode) {
      reasons.push("summary_condition_mismatch");
    }
  }

  return { ok: reasons.length === 0, reasons };
}
