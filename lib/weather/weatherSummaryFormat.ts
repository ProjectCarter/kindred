/**
 * Client-side weather summary formatting — mirrors supabase/functions/_shared/weather/units.ts.
 */

import {
  formatTempC,
  type TemperatureUnit,
} from "./units.ts";

export function weatherConditionPhrase(
  code: number | null | undefined
): string | null {
  if (code == null || !Number.isFinite(code)) return null;
  if (code === 0) return "plenty of sunshine";
  if (code === 1) return "mostly clear skies";
  if (code === 2) return "partly cloudy skies";
  if (code === 3) return "overcast skies";
  if (code === 45 || code === 48) return "patchy fog";
  if (code === 51 || code === 53 || code === 55) return "a light drizzle";
  if (code === 56 || code === 57) return "freezing drizzle";
  if (code === 61 || code === 63 || code === 65) return "rain likely";
  if (code === 66 || code === 67) return "freezing rain likely";
  if (code === 71 || code === 73 || code === 75) return "snow likely";
  if (code === 77) return "flurries of snow";
  if (code === 80 || code === 81 || code === 82) return "rain showers likely";
  if (code === 85 || code === 86) return "snow showers likely";
  if (code === 95 || code === 96 || code === 99) return "thunderstorms possible";
  return null;
}

export function formatWeatherSummary(input: {
  city: string | null;
  currentC: number | null;
  highC: number | null;
  lowC: number | null;
  unit: TemperatureUnit;
  conditionCode?: number | null;
}): string | null {
  const current = formatTempC(input.currentC, input.unit);
  if (!current) return null;
  const place =
    input.city && input.city !== "your area" ? input.city : "your area";
  const high = formatTempC(input.highC, input.unit);
  const low = formatTempC(input.lowC, input.unit);
  const condition = weatherConditionPhrase(input.conditionCode ?? null);
  const range =
    high && low
      ? `high ${high} / low ${low}`
      : high
        ? `high ${high}`
        : low
          ? `low ${low}`
          : null;
  const parts = [`Current ${current} in ${place}`, range, condition].filter(
    (p): p is string => Boolean(p)
  );
  return `${parts.join("; ")}.`;
}
