/**
 * Forecast-based weather guidance — one verified sentence beneath the summary.
 * Never references edition desks; always grounded in observed forecast signals.
 */

import type { KindredWeatherSnapshot } from "./weatherSnapshot.ts";
import type { ParsedWeatherSummary } from "./parseWeatherSummary.ts";
import { weatherConditionFromWmoCode } from "./weatherEmojiGuide.ts";

export type WeatherGuidanceInput = {
  snapshot?: KindredWeatherSnapshot | null;
  parsed?: ParsedWeatherSummary | null;
  /** Pre-computed guidance from edition build — preferred when present. */
  persistedGuidance?: string | null;
};

function parseTempF(label: string | null | undefined): number | null {
  if (!label?.trim()) return null;
  const match = /^(\d+)°/.exec(label.trim());
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function cToF(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}

function deriveHighLowF(input: WeatherGuidanceInput): {
  highF: number | null;
  lowF: number | null;
  currentF: number | null;
} {
  const snapshot = input.snapshot;
  const parsed = input.parsed;
  const unit = snapshot?.unit ?? "fahrenheit";

  const currentF =
    snapshot != null
      ? unit === "fahrenheit"
        ? cToF(snapshot.currentTempC)
        : Math.round(snapshot.currentTempC)
      : parseTempF(parsed?.currentLabel ?? null);

  const highF =
    snapshot?.highTempC != null
      ? unit === "fahrenheit"
        ? cToF(snapshot.highTempC)
        : Math.round(snapshot.highTempC)
      : parseTempF(parsed?.highLabel ?? null);

  const lowF =
    snapshot?.lowTempC != null
      ? unit === "fahrenheit"
        ? cToF(snapshot.lowTempC)
        : Math.round(snapshot.lowTempC)
      : parseTempF(parsed?.lowLabel ?? null);

  return { highF, lowF, currentF };
}

function isRainCode(code: number): boolean {
  return [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code);
}

function isStormCode(code: number): boolean {
  return [95, 96, 99].includes(code);
}

function isSnowCode(code: number): boolean {
  return [71, 73, 75, 77, 85, 86].includes(code);
}

/**
 * Deterministic guidance from verified forecast signals only.
 * Returns null when there is not enough data to write honest copy.
 */
export function composeWeatherGuidance(input: WeatherGuidanceInput): string | null {
  if (input.persistedGuidance?.trim()) {
    return input.persistedGuidance.trim();
  }

  const snapshot = input.snapshot;
  const parsed = input.parsed;
  if (!snapshot && !parsed) return null;

  const { highF, lowF, currentF } = deriveHighLowF(input);
  const code = snapshot?.conditionCode ?? null;
  const windSpeedMs = snapshot?.windSpeedMs ?? null;
  const condition = snapshot
    ? weatherConditionFromWmoCode(code, windSpeedMs)
    : null;

  const activeAlerts = snapshot?.alerts ?? [];
  const heatAlert = activeAlerts.some((a) =>
    /extreme heat|excessive heat|heat warning|heat advisory/i.test(a.event)
  );
  const isHot = heatAlert || (highF != null && highF >= 100);
  const isCold = lowF != null && lowF <= 32;
  const isRainy = code != null ? isRainCode(code) : false;
  const isStormy = code != null ? isStormCode(code) : false;
  const isSnowy = code != null ? isSnowCode(code) : false;
  const isWindy =
    (windSpeedMs ?? 0) >= 11 ||
    condition?.key === "windy";
  const isClear =
    condition?.key === "sunny" ||
    condition?.key === "mostly_sunny";

  if (isHot && highF != null) {
    return `High of ${highF}° today with dangerous afternoon heat. Plan outdoor activities early or after sunset.`;
  }

  if (isCold && lowF != null && highF != null) {
    return `Cold start near ${lowF}° with a high of ${highF}°. Dress in layers if you are heading out early.`;
  }

  if (isStormy) {
    return "Thunderstorms are in the forecast. Have a backup plan if you are heading outdoors.";
  }

  if (isSnowy) {
    return "Snow is expected today. Allow extra time if you are traveling.";
  }

  if (isRainy) {
    return "Scattered showers are expected. Keep an umbrella nearby.";
  }

  if (isWindy) {
    return "Breezy conditions will develop this afternoon.";
  }

  if (isClear && highF != null) {
    return "Expect sunshine throughout the day with warm afternoon temperatures.";
  }

  if (highF != null && currentF != null && highF - currentF >= 15 && currentF <= 65) {
    return `Cool morning temperatures around ${currentF}° with a high near ${highF}° today.`;
  }

  if (highF != null && lowF != null) {
    return `High of ${highF}° and low of ${lowF}° today.`;
  }

  return null;
}
