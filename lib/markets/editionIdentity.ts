import type { KindredPlace } from "../location/types";
import {
  resolveEditionMarket,
  type EditionLocationInput,
} from "./resolveEditionMarket";

/** Canonical market key for edition persistence and cache identity. */
export function editionMetroKeyFromPlace(
  place: Pick<KindredPlace, "city" | "state" | "region" | "lat" | "lon">
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

export function generationJobsConflictTarget(): "user_id,edition_date,metro_key" {
  return "user_id,edition_date,metro_key";
}

export function canRecoverLocalEventsForMetro(input: {
  place: KindredPlace;
  expectedMetroKey?: string | null;
  cachedMetroKey?: string | null;
}): boolean {
  if (
    input.expectedMetroKey &&
    editionMetroKeyFromPlace(input.place) !== input.expectedMetroKey
  ) {
    return false;
  }
  if (
    input.cachedMetroKey &&
    input.expectedMetroKey &&
    input.cachedMetroKey !== input.expectedMetroKey
  ) {
    return false;
  }
  return true;
}
