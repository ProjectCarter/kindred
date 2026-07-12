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
}): string | null {
  const current = formatTempC(input.currentC, input.unit);
  if (!current) return null;
  const place = input.city && input.city !== "your area" ? input.city : "your area";
  const high = formatTempC(input.highC, input.unit);
  const low = formatTempC(input.lowC, input.unit);
  const range =
    high && low
      ? `high ${high} / low ${low}`
      : high
        ? `high ${high}`
        : low
          ? `low ${low}`
          : null;
  return range
    ? `Current ${current} in ${place}; ${range}.`
    : `Current ${current} in ${place}.`;
}

export function unitInstruction(unit: TemperatureUnit): string {
  return unit === "fahrenheit"
    ? "Use Fahrenheit (°F) for all temperatures. Never use Celsius."
    : "Use Celsius (°C) for all temperatures. Never use Fahrenheit.";
}
