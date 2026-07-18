import {
  resolveEditionMarket,
  type EditionLocationInput,
} from "./editionMarket.ts";

/** Canonical market key for edition persistence and cache identity. */
export function editionMetroKeyFromPlace(
  place: {
    city: string;
    state?: string | null;
    region?: string | null;
    lat: number;
    lon: number;
  }
): string | null {
  return editionMetroKeyFromLocationInput({
    city: place.city,
    state: place.state,
    region: place.region,
    lat: place.lat,
    lon: place.lon,
  });
}

export function editionMetroKeyFromLocationInput(
  input: EditionLocationInput
): string | null {
  return resolveEditionMarket(input)?.metroKey ?? null;
}

export function editionIdentityKey(input: {
  userId: string;
  editionDate: string;
  metroKey: string;
}): string {
  return `${input.userId}:${input.editionDate}:${input.metroKey}`;
}

export function editionsConflictTarget(): "user_id,edition_date,metro_key" {
  return "user_id,edition_date,metro_key";
}
