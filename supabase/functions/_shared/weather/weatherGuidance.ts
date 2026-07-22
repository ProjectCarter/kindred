/**
 * Forecast-based weather guidance — server mirror of lib/weather/weatherGuidance.ts
 */

import type { KindredWeatherSnapshot } from "./weatherSnapshot.ts";
import { weatherConditionFromWmoCode } from "./weatherEmojiGuide.ts";

function cToF(c: number): number {
  return Math.round((c * 9) / 5 + 32);
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

export function composeWeatherGuidanceFromSnapshot(
  snapshot: KindredWeatherSnapshot
): string | null {
  const unit = snapshot.unit;
  const highF =
    snapshot.highTempC != null
      ? unit === "fahrenheit"
        ? cToF(snapshot.highTempC)
        : Math.round(snapshot.highTempC)
      : null;
  const lowF =
    snapshot.lowTempC != null
      ? unit === "fahrenheit"
        ? cToF(snapshot.lowTempC)
        : Math.round(snapshot.lowTempC)
      : null;
  const currentF =
    unit === "fahrenheit"
      ? cToF(snapshot.currentTempC)
      : Math.round(snapshot.currentTempC);

  const code = snapshot.conditionCode;
  const condition = weatherConditionFromWmoCode(code, snapshot.windSpeedMs);
  const heatAlert = snapshot.alerts.some((a) =>
    /extreme heat|excessive heat|heat warning|heat advisory/i.test(a.event)
  );
  const isHot = heatAlert || (highF != null && highF >= 100);
  const isCold = lowF != null && lowF <= 32;
  const isRainy = isRainCode(code);
  const isStormy = isStormCode(code);
  const isSnowy = isSnowCode(code);
  const isWindy = (snapshot.windSpeedMs ?? 0) >= 11 || condition?.key === "windy";
  const isClear =
    condition?.key === "sunny" || condition?.key === "mostly_sunny";

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
