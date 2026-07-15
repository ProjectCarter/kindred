/**
 * Verified location helpers — reject partial addresses and malformed maps queries.
 * Trust rule: hide Maps rather than send readers to the wrong place.
 */

import type { MapsDestination } from "./googleMaps";

const STREET_SUFFIX =
  /\b(st|street|ste|suite|ave|avenue|rd|road|dr|drive|blvd|boulevard|way|ln|lane|ct|court|hwy|highway|pkwy|parkway|pl|place|trl|trail|cir|circle)\b/i;

function isValidCoord(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** True when the string looks like a complete street address, not just a number. */
export function isUsableStreetAddress(address: string): boolean {
  const line = address.replace(/\s+/g, " ").trim();
  if (!line || line.length < 4) return false;

  // Bare building number only — e.g. "1839"
  if (/^\d+[a-z]?$/i.test(line)) return false;

  // Number + city/state only — e.g. "1839, Gilbert, AZ"
  const firstSegment = line.split(",")[0]?.trim() ?? "";
  if (/^\d+[a-z]?$/i.test(firstSegment) && line.includes(",")) {
    return false;
  }

  // Must include alphabetic street name characters
  if (!/[a-z]/i.test(line)) return false;

  // Short numeric-only prefix without a recognizable street suffix
  if (
    /^\d+\s+[a-z]/i.test(line) &&
    !STREET_SUFFIX.test(line) &&
    line.length < 12
  ) {
    // "1839 Gilbert" style fragments without a street type
    const afterNumber = line.replace(/^\d+[a-z]?\s+/i, "");
    if (!/\s/.test(afterNumber) || afterNumber.split(/\s+/).length < 2) {
      return false;
    }
  }

  return true;
}

export function sanitizeAddressForDisplay(
  address: string | null | undefined
): string | null {
  const line = address?.trim();
  if (!line) return null;
  return isUsableStreetAddress(line) ? line : null;
}

/** Build a verified address from provider parts — never emit number-only strings. */
export function composeVerifiedAddress(parts: {
  formatted?: string | null;
  street?: string | null;
  city?: string | null;
  region?: string | null;
  state?: string | null;
}): string | null {
  const formatted = parts.formatted?.trim();
  if (formatted && isUsableStreetAddress(formatted)) return formatted;

  const street = parts.street?.trim();
  const city = parts.city?.trim();
  const state = (parts.state ?? parts.region)?.trim();
  if (!street || !isUsableStreetAddress(street)) return null;

  const joined = [street, city, state].filter(Boolean).join(", ");
  return isUsableStreetAddress(joined) ? joined : null;
}

/** Drop destinations that cannot resolve to a trustworthy Maps query. */
export function verifiedMapsDestination(
  dest: MapsDestination | null | undefined
): MapsDestination | null {
  if (!dest) return null;
  const cleaned: MapsDestination = {
    lat: dest.lat,
    lon: dest.lon,
    name: dest.name?.trim() || null,
    city: dest.city?.trim() || null,
    region: dest.region?.trim() || null,
    state: dest.state?.trim() || null,
    address: sanitizeAddressForDisplay(dest.address),
  };

  if (isValidCoord(cleaned.lat) && isValidCoord(cleaned.lon)) return cleaned;

  if (cleaned.address) return cleaned;

  const name = cleaned.name;
  const city = cleaned.city;
  const region = cleaned.region || cleaned.state;
  if (name && (city || region)) return cleaned;

  return null;
}

export function mapsDestinationFromPlace(input: {
  lat?: number | null;
  lon?: number | null;
  name?: string | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  state?: string | null;
}): MapsDestination | null {
  return verifiedMapsDestination({
    lat: input.lat,
    lon: input.lon,
    address: input.address,
    name: input.name,
    city: input.city,
    region: input.region,
    state: input.state,
  });
}
