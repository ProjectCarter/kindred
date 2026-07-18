/**
 * Decide whether a ready edition should be withheld as the wrong city.
 */

import { citiesMatch } from "../location/locationKey.ts";

/**
 * When the authoritative built city matches the reader, do not withhold
 * merely because local_events majority city differs — metro papers often
 * list parent-city venues (e.g. Gilbert reader, Phoenix-labeled events).
 */
export function shouldWithholdEditionForCityMismatch(input: {
  activeCity: string | null | undefined;
  builtCity: string | null | undefined;
  sectionCity: string | null | undefined;
  mode: string | null | undefined;
}): boolean {
  const activeCity = input.activeCity?.trim() || null;
  if (!activeCity) return false;

  const builtCity = input.builtCity?.trim() || null;
  if (builtCity) {
    return !citiesMatch(activeCity, builtCity);
  }

  // Unknown build city: Current Location must not trust a foreign paper.
  if (input.mode === "current") return true;

  const sectionCity = input.sectionCity?.trim() || null;
  return Boolean(sectionCity && !citiesMatch(activeCity, sectionCity));
}
