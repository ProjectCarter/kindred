/**
 * Live home edition must never paint a calendar day before the reader's local
 * today. Dev preview pins and AsyncStorage caches can otherwise serve yesterday
 * with yesterday's date line still on screen.
 */

import { localEditionDate } from "./dates.ts";

/** Reader-local calendar day — YYYY-MM-DD, not UTC. */
export function calendarEditionDate(now: Date = new Date()): string {
  return localEditionDate(now);
}

export function isPastEditionDate(
  editionDate: string | null | undefined,
  calendarToday: string = calendarEditionDate()
): boolean {
  const d = editionDate?.trim();
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  return d < calendarToday;
}

/** Home load never keys or paints an edition before local today. */
export function liveHomeEditionDate(
  candidate: string | null | undefined,
  calendarToday: string = calendarEditionDate()
): string {
  const d = candidate?.trim();
  if (d && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isPastEditionDate(d, calendarToday)) {
    return d;
  }
  return calendarToday;
}

export type EditionDateTrace = {
  handoff: string;
  deviceLocalDatetime: string;
  timezone: string | null;
  calendarEditionDate: string;
  calculatedEditionDate: string | null;
  requestedSupabaseEditionDate: string | null;
  returnedEditionDate: string | null;
  cachedEditionDate: string | null;
  cacheHit: boolean | null;
  masterpieceId: string | null;
  todayInHistoryMonthDay: string | null;
  rawActivityCount: number | null;
  validUniqueActivityCount: number | null;
  seeAllAccessibleCount: number | null;
};

export function logEditionDateTrace(input: EditionDateTrace): void {
  if (!__DEV__) return;
  console.log("[edition-date-trace]", input);
}

export function deviceLocalDatetimeIso(now: Date = new Date()): string {
  return now.toString();
}

export function todayInHistoryMonthDayFromEditionDate(
  editionDate: string | null | undefined
): string | null {
  const d = editionDate?.trim();
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const [, month, day] = d.split("-");
  return `${month}-${day}`;
}

export function editionDateTraceBase(handoff: string): Pick<
  EditionDateTrace,
  "handoff" | "deviceLocalDatetime" | "timezone" | "calendarEditionDate"
> {
  let timezone: string | null = null;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    timezone = tz && tz.length > 0 ? tz : null;
  } catch {
    timezone = null;
  }
  return {
    handoff,
    deviceLocalDatetime: deviceLocalDatetimeIso(),
    timezone,
    calendarEditionDate: calendarEditionDate(),
  };
}
