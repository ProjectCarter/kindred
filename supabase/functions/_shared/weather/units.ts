/**
 * Edge-side temperature formatting (mirrors lib/weather/units.ts).
 * Keep in sync — Deno Edge Functions cannot import the React Native module.
 */

export type TemperatureUnitPreference = "auto" | "fahrenheit" | "celsius";
export type TemperatureUnit = "fahrenheit" | "celsius";

const US_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC",
]);

const US_STATE_NAMES = new Set([
  "alabama", "alaska", "arizona", "arkansas", "california", "colorado",
  "connecticut", "delaware", "florida", "georgia", "hawaii", "idaho",
  "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana",
  "maine", "maryland", "massachusetts", "michigan", "minnesota",
  "mississippi", "missouri", "montana", "nebraska", "nevada",
  "new hampshire", "new jersey", "new mexico", "new york",
  "north carolina", "north dakota", "ohio", "oklahoma", "oregon",
  "pennsylvania", "rhode island", "south carolina", "south dakota",
  "tennessee", "texas", "utah", "vermont", "virginia", "washington",
  "west virginia", "wisconsin", "wyoming", "district of columbia",
]);

export function isUnitedStatesLocation(place: {
  state?: string | null;
  region?: string | null;
}): boolean {
  const state = place.state?.trim() ?? "";
  if (state.length === 2 && US_STATE_CODES.has(state.toUpperCase())) {
    return true;
  }
  const region = (place.region ?? place.state ?? "").trim().toLowerCase();
  return Boolean(region && US_STATE_NAMES.has(region));
}

export function resolveTemperatureUnit(
  preference: TemperatureUnitPreference | null | undefined,
  place: { state?: string | null; region?: string | null }
): TemperatureUnit {
  if (preference === "fahrenheit") return "fahrenheit";
  if (preference === "celsius") return "celsius";
  if (isUnitedStatesLocation(place)) return "fahrenheit";
  return "celsius";
}

function convert(valueC: number, unit: TemperatureUnit): number {
  if (unit === "fahrenheit") return Math.round((valueC * 9) / 5 + 32);
  return Math.round(valueC);
}

export function formatTempC(
  valueC: number | null | undefined,
  unit: TemperatureUnit
): string | null {
  if (valueC == null || !Number.isFinite(valueC)) return null;
  const n = convert(valueC, unit);
  return unit === "fahrenheit" ? `${n}°F` : `${n}°C`;
}

export function formatWeatherSummary(input: {
  city: string | null;
  currentC: number | null;
  highC: number | null;
  lowC: number | null;
  unit: TemperatureUnit;
  /** Open-Meteo `weather_code` — grounds an honest sky phrase, never invented. */
  conditionCode?: number | null;
}): string | null {
  const current = formatTempC(input.currentC, input.unit);
  if (!current) return null;
  const place = input.city && input.city !== "your area" ? input.city : "your area";
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

/**
 * WMO weather codes (Open-Meteo `weather_code`) -> a plain-language sky
 * phrase, so editorial copy can say "plenty of sunshine" or "rain likely"
 * from real data instead of the AI guessing or inventing conditions.
 */
export function weatherConditionPhrase(code: number | null | undefined): string | null {
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

export function unitInstruction(unit: TemperatureUnit): string {
  return unit === "fahrenheit"
    ? "Use Fahrenheit (°F) for all temperatures. Never use Celsius."
    : "Use Celsius (°C) for all temperatures. Never use Fahrenheit.";
}
