/**
 * Server-side address validation — mirrors lib/edition/verifiedLocation.ts.
 */

const STREET_SUFFIX =
  /\b(st|street|ste|suite|ave|avenue|rd|road|dr|drive|blvd|boulevard|way|ln|lane|ct|court|hwy|highway|pkwy|parkway|pl|place|trl|trail|cir|circle)\b/i;

export function isUsableStreetAddress(address: string): boolean {
  const line = address.replace(/\s+/g, " ").trim();
  if (!line || line.length < 4) return false;
  if (/^\d+[a-z]?$/i.test(line)) return false;

  const firstSegment = line.split(",")[0]?.trim() ?? "";
  if (/^\d+[a-z]?$/i.test(firstSegment) && line.includes(",")) {
    return false;
  }

  if (!/[a-z]/i.test(line)) return false;

  if (
    /^\d+\s+[a-z]/i.test(line) &&
    !STREET_SUFFIX.test(line) &&
    line.length < 12
  ) {
    const afterNumber = line.replace(/^\d+[a-z]?\s+/i, "");
    if (!/\s/.test(afterNumber) || afterNumber.split(/\s+/).length < 2) {
      return false;
    }
  }

  return true;
}

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
