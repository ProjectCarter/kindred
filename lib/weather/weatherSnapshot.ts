/**
 * Structured weather snapshot persisted on the edition — grounds homepage display.
 */

import type { TemperatureUnit } from "./units.ts";
import type { WeatherAlertDisplay } from "./weatherEmojiGuide.ts";
import {
  weatherAlertCompactDisplay,
  weatherConditionFromWmoCode,
} from "./weatherEmojiGuide.ts";

export type KindredWeatherAlert = {
  event: string;
  start: number;
  end: number;
};

export type KindredWeatherSnapshot = {
  /** ISO timestamp of the provider observation used for current conditions. */
  retrievedAt: string;
  conditionCode: number;
  currentTempC: number;
  highTempC: number | null;
  lowTempC: number | null;
  windSpeedMs: number | null;
  unit: TemperatureUnit;
  alerts: KindredWeatherAlert[];
  /** Forecast-based guidance — never fabricated when data is insufficient. */
  guidanceNote: string | null;
};

export function extractWeatherSnapshotFromEditorialContext(
  value: unknown
): KindredWeatherSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { weatherSnapshot?: unknown };
  return parseWeatherSnapshot(raw.weatherSnapshot);
}

export function parseWeatherSnapshot(value: unknown): KindredWeatherSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const retrievedAt =
    typeof row.retrievedAt === "string" ? row.retrievedAt.trim() : "";
  const conditionCode = Number(row.conditionCode);
  const currentTempC = Number(row.currentTempC);
  if (!retrievedAt || !Number.isFinite(conditionCode) || !Number.isFinite(currentTempC)) {
    return null;
  }

  const unit = row.unit === "celsius" ? "celsius" : "fahrenheit";
  const alerts = Array.isArray(row.alerts)
    ? row.alerts
        .map((a) => {
          if (!a || typeof a !== "object") return null;
          const alert = a as Record<string, unknown>;
          const event = typeof alert.event === "string" ? alert.event.trim() : "";
          if (!event) return null;
          return {
            event,
            start: Number(alert.start) || 0,
            end: Number(alert.end) || 0,
          };
        })
        .filter((a): a is KindredWeatherAlert => Boolean(a))
    : [];

  return {
    retrievedAt,
    conditionCode,
    currentTempC,
    highTempC: Number.isFinite(Number(row.highTempC))
      ? Number(row.highTempC)
      : null,
    lowTempC: Number.isFinite(Number(row.lowTempC))
      ? Number(row.lowTempC)
      : null,
    windSpeedMs: Number.isFinite(Number(row.windSpeedMs))
      ? Number(row.windSpeedMs)
      : null,
    unit,
    alerts,
    guidanceNote:
      typeof row.guidanceNote === "string" ? row.guidanceNote.trim() || null : null,
  };
}

export function activeWeatherAlerts(
  snapshot: KindredWeatherSnapshot,
  nowMs = Date.now()
): KindredWeatherAlert[] {
  return snapshot.alerts.filter((a) => {
    if (!a.start && !a.end) return true;
    if (a.end && a.end * 1000 < nowMs) return false;
    if (a.start && a.start * 1000 > nowMs + 24 * 60 * 60 * 1000) return false;
    return true;
  });
}

export function primaryWeatherAlertDisplay(
  snapshot: KindredWeatherSnapshot,
  nowMs = Date.now()
): WeatherAlertDisplay | null {
  const active = activeWeatherAlerts(snapshot, nowMs);
  if (!active.length) return null;
  return weatherAlertCompactDisplay(active[0]!.event);
}

export function snapshotConditionDisplay(snapshot: KindredWeatherSnapshot) {
  return weatherConditionFromWmoCode(
    snapshot.conditionCode,
    snapshot.windSpeedMs
  );
}
