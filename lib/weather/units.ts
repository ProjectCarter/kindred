/**
 * Temperature unit preference — shared display formatting.
 * Internal values stay Celsius; format at the edge of the system.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

export type TemperatureUnitPreference = "auto" | "fahrenheit" | "celsius";
export type TemperatureUnit = "fahrenheit" | "celsius";

const PREF_KEY = "@kindred/temperature-unit-v1";

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
  countryCode?: string | null;
}): boolean {
  const cc = place.countryCode?.trim().toUpperCase();
  if (cc === "US" || cc === "USA") return true;
  const state = place.state?.trim() ?? "";
  if (state.length === 2 && US_STATE_CODES.has(state.toUpperCase())) {
    return true;
  }
  const region = (place.region ?? place.state ?? "").trim().toLowerCase();
  if (region && US_STATE_NAMES.has(region)) return true;
  return false;
}

export function resolveTemperatureUnit(
  preference: TemperatureUnitPreference,
  place: {
    state?: string | null;
    region?: string | null;
    countryCode?: string | null;
  } | null
): TemperatureUnit {
  if (preference === "fahrenheit") return "fahrenheit";
  if (preference === "celsius") return "celsius";
  if (place && isUnitedStatesLocation(place)) return "fahrenheit";
  return "celsius";
}

export function celsiusToFahrenheit(c: number): number {
  return (c * 9) / 5 + 32;
}

/** Round for display — whole degrees for both units. */
export function convertTempC(
  valueC: number,
  unit: TemperatureUnit
): number {
  if (unit === "fahrenheit") return Math.round(celsiusToFahrenheit(valueC));
  return Math.round(valueC);
}

export function formatTempC(
  valueC: number | null | undefined,
  unit: TemperatureUnit
): string | null {
  if (valueC == null || !Number.isFinite(valueC)) return null;
  const n = convertTempC(valueC, unit);
  return unit === "fahrenheit" ? `${n}°F` : `${n}°C`;
}

export function formatTempRangeC(
  highC: number | null | undefined,
  lowC: number | null | undefined,
  unit: TemperatureUnit
): string | null {
  const high = formatTempC(highC, unit);
  const low = formatTempC(lowC, unit);
  if (high && low) return `high ${high} / low ${low}`;
  if (high) return `high ${high}`;
  if (low) return `low ${low}`;
  return null;
}

export async function getTemperatureUnitPreference(): Promise<TemperatureUnitPreference> {
  try {
    const raw = await AsyncStorage.getItem(PREF_KEY);
    if (raw === "fahrenheit" || raw === "celsius" || raw === "auto") {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return "auto";
}

export async function setTemperatureUnitPreference(
  preference: TemperatureUnitPreference
): Promise<void> {
  try {
    await AsyncStorage.setItem(PREF_KEY, preference);
  } catch {
    /* ignore */
  }
}

export function unitLabel(unit: TemperatureUnit): string {
  return unit === "fahrenheit" ? "Fahrenheit" : "Celsius";
}

export function preferenceLabel(pref: TemperatureUnitPreference): string {
  if (pref === "auto") return "Automatic";
  if (pref === "fahrenheit") return "Fahrenheit";
  return "Celsius";
}
