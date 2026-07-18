import { metroKeyFromPlace } from "../location/metroKey.ts";
import {
  resolveEditionMarket,
  type EditionLocationInput,
} from "./resolveEditionMarket.ts";

export type LibraryLocationInput = EditionLocationInput;

/** Legacy naive city-state slug (e.g. gilbert-az). */
export function legacyMetroKeyFromLocation(
  input: Pick<LibraryLocationInput, "city" | "state" | "region">
): string {
  return metroKeyFromPlace(input);
}

/** Canonical market key for edition/catalog identity (e.g. phoenix-az for Gilbert). */
export function canonicalMetroKeyFromLocation(
  input: LibraryLocationInput
): string | null {
  return resolveEditionMarket(input)?.metroKey ?? null;
}

/**
 * Metro keys to try when loading evergreen library content (Story of, History).
 * Canonical first (nationwide target); legacy second (suburb-seeded content).
 */
export function libraryMetroKeysForLocation(input: LibraryLocationInput): string[] {
  const legacy = legacyMetroKeyFromLocation(input);
  const canonical = canonicalMetroKeyFromLocation(input);
  const keys: string[] = [];
  if (canonical) keys.push(canonical);
  if (legacy !== canonical) keys.push(legacy);
  if (!keys.length) keys.push(legacy);
  return keys;
}

/**
 * Metro keys for The Story of [City] — edition city slug first so Gilbert
 * readers get Gilbert, not the parent metro article (e.g. Phoenix).
 */
export function storyOfMetroKeysForLocation(input: LibraryLocationInput): string[] {
  const legacy = legacyMetroKeyFromLocation(input);
  const canonical = canonicalMetroKeyFromLocation(input);
  const keys: string[] = [];
  if (legacy) keys.push(legacy);
  if (canonical && canonical !== legacy) keys.push(canonical);
  if (!keys.length && legacy) keys.push(legacy);
  return keys;
}
