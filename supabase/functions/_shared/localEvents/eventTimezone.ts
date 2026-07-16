/**
 * Resolve the IANA timezone used for event schedule comparisons.
 * Events are verified in the venue's local timezone — not UTC alone.
 */

import type { LocalEventLocation } from "./provider.ts";

export const DEFAULT_EVENT_TIMEZONE = "America/Phoenix";

/** US state → primary IANA timezone (conservative single-zone mapping). */
const US_STATE_TIMEZONE: Record<string, string> = {
  AL: "America/Chicago",
  AK: "America/Anchorage",
  AZ: "America/Phoenix",
  AR: "America/Chicago",
  CA: "America/Los_Angeles",
  CO: "America/Denver",
  CT: "America/New_York",
  DE: "America/New_York",
  DC: "America/New_York",
  FL: "America/New_York",
  GA: "America/New_York",
  HI: "Pacific/Honolulu",
  ID: "America/Boise",
  IL: "America/Chicago",
  IN: "America/Indiana/Indianapolis",
  IA: "America/Chicago",
  KS: "America/Chicago",
  KY: "America/New_York",
  LA: "America/Chicago",
  ME: "America/New_York",
  MD: "America/New_York",
  MA: "America/New_York",
  MI: "America/Detroit",
  MN: "America/Chicago",
  MS: "America/Chicago",
  MO: "America/Chicago",
  MT: "America/Denver",
  NE: "America/Chicago",
  NV: "America/Los_Angeles",
  NH: "America/New_York",
  NJ: "America/New_York",
  NM: "America/Denver",
  NY: "America/New_York",
  NC: "America/New_York",
  ND: "America/Chicago",
  OH: "America/New_York",
  OK: "America/Chicago",
  OR: "America/Los_Angeles",
  PA: "America/New_York",
  RI: "America/New_York",
  SC: "America/New_York",
  SD: "America/Chicago",
  TN: "America/Chicago",
  TX: "America/Chicago",
  UT: "America/Denver",
  VT: "America/New_York",
  VA: "America/New_York",
  WA: "America/Los_Angeles",
  WV: "America/New_York",
  WI: "America/Chicago",
  WY: "America/Denver",
};

export function resolveEventTimezone(
  location?: Pick<LocalEventLocation, "state"> | null,
  explicit?: string | null
): string {
  const tz = explicit?.trim();
  if (tz) return tz;
  const state = location?.state?.trim().toUpperCase();
  if (state && US_STATE_TIMEZONE[state]) return US_STATE_TIMEZONE[state];
  return DEFAULT_EVENT_TIMEZONE;
}

export type ZonedDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function zonedPartsFromDate(
  date: Date,
  timeZone: string
): ZonedDateTimeParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value ?? "0";
    return Number(value);
  };
  const hour = read("hour") % 24;
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour,
    minute: read("minute"),
    second: read("second"),
  };
}

/** Build a UTC instant for a wall-clock time in the given IANA timezone. */
export function instantInTimeZone(
  components: ZonedDateTimeParts,
  timeZone: string
): Date {
  let utc = Date.UTC(
    components.year,
    components.month - 1,
    components.day,
    components.hour,
    components.minute,
    components.second
  );
  for (let i = 0; i < 4; i++) {
    const actual = zonedPartsFromDate(new Date(utc), timeZone);
    const desiredMs = Date.UTC(
      components.year,
      components.month - 1,
      components.day,
      components.hour,
      components.minute,
      components.second
    );
    const actualMs = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second
    );
    utc += desiredMs - actualMs;
  }
  return new Date(utc);
}

export function compareZonedParts(
  a: ZonedDateTimeParts,
  b: ZonedDateTimeParts
): number {
  const aMs = Date.UTC(a.year, a.month - 1, a.day, a.hour, a.minute, a.second);
  const bMs = Date.UTC(b.year, b.month - 1, b.day, b.hour, b.minute, b.second);
  return aMs === bMs ? 0 : aMs < bMs ? -1 : 1;
}

export function endOfLocalDay(
  year: number,
  month: number,
  day: number,
  timeZone: string
): Date {
  return instantInTimeZone(
    { year, month, day, hour: 23, minute: 59, second: 59 },
    timeZone
  );
}

export function startOfLocalDay(
  year: number,
  month: number,
  day: number,
  timeZone: string
): Date {
  return instantInTimeZone(
    { year, month, day, hour: 0, minute: 0, second: 0 },
    timeZone
  );
}
