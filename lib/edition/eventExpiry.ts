/**
 * Event lifecycle for Clippings — events, unlike Articles/Activities/
 * Recommendations, naturally expire. This module resolves a best-effort
 * "when did this event actually end" timestamp from the free-text
 * date/time strings Kindred already shows readers (e.g. "Sat, Jul 12" +
 * "7 – 9 PM"), then answers two simple questions from that one timestamp:
 * is it already over ("Past Event"), and has it been over long enough to
 * quietly remove from My Clippings (30 full calendar days).
 *
 * Resolution happens once, at the moment the event is turned into a
 * KindredArticle (see `articleFromLocalEvent`) — with "now" genuinely
 * meaning today, so short month/day strings (no year in the source data)
 * resolve unambiguously. The result is persisted on the clipping row and
 * never recomputed from the saved date, per the "expiration must be based
 * on when the event itself ended" rule.
 */

/** Grace period a past event stays visible (with a "Past Event" note) before quiet removal. */
export const EVENT_CLIPPING_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

type ResolvedDateSpan = {
  /** 0–11, the LAST day of the event (single-day events: same as the only day). */
  endMonth: number;
  endDay: number;
};

/**
 * Parses Kindred's `event.date` display string (e.g. "Sat, Jul 12",
 * "Jul 12 – Jul 14", "Jul 12 – 14", "Today", "Tomorrow") into the final
 * calendar day the event covers. Deliberately conservative — anything
 * that isn't a recognizable date ("This week", "Date TBA") resolves to
 * `null` so the caller can decline to guess an expiration rather than
 * remove something prematurely.
 */
function parseEventDateSpan(dateStr: string, now: Date): ResolvedDateSpan | null {
  const raw = dateStr.trim();
  if (!raw) return null;

  if (/^today$/i.test(raw)) {
    return { endMonth: now.getMonth(), endDay: now.getDate() };
  }
  if (/^tomorrow$/i.test(raw)) {
    const t = new Date(now);
    t.setDate(t.getDate() + 1);
    return { endMonth: t.getMonth(), endDay: t.getDate() };
  }

  // Multi-day range — "Jul 12 – Jul 14" or "Jul 12 – 14". Always the
  // LAST day, per "begin the countdown after the final day ends".
  const rangeMatch = raw.match(
    /([A-Za-z]{3,9})\.?\s+(\d{1,2})\s*(?:st|nd|rd|th)?\s*[–—-]\s*(?:([A-Za-z]{3,9})\.?\s+)?(\d{1,2})\s*(?:st|nd|rd|th)?/
  );
  if (rangeMatch) {
    const endMonthName = (rangeMatch[3] ?? rangeMatch[1]).toLowerCase();
    const endMonth = MONTHS[endMonthName];
    const endDay = Number(rangeMatch[4]);
    if (endMonth !== undefined && endDay >= 1 && endDay <= 31) {
      return { endMonth, endDay };
    }
  }

  // Single day — "Sat, Jul 12" or "Jul 12".
  const singleMatch = raw.match(
    /([A-Za-z]{3,9})\.?\s+(\d{1,2})\s*(?:st|nd|rd|th)?/
  );
  if (singleMatch) {
    const month = MONTHS[singleMatch[1].toLowerCase()];
    const day = Number(singleMatch[2]);
    if (month !== undefined && day >= 1 && day <= 31) {
      return { endMonth: month, endDay: day };
    }
  }

  return null;
}

/**
 * Source data never includes a year — infer the closest sensible one
 * relative to `now`. Local event listings are always near-term, so if the
 * naive same-year date already looks more than ~45 days in the past
 * (including the "we're in December and this says January" wraparound),
 * it must mean next year instead.
 */
function inferYear(month: number, day: number, now: Date): number {
  const candidate = new Date(now.getFullYear(), month, day, 23, 59, 59);
  const FORTY_FIVE_DAYS_MS = 45 * 24 * 60 * 60 * 1000;
  if (now.getTime() - candidate.getTime() > FORTY_FIVE_DAYS_MS) {
    return now.getFullYear() + 1;
  }
  return now.getFullYear();
}

type ResolvedEndTime = { hour: number; minute: number };

/**
 * Parses Kindred's `event.time` display string for an explicit END time —
 * "7 – 9 PM" / "7 PM – 9 PM" / "7:30 – 9:00 PM" all resolve to 9 (:00 /
 * :30) PM. A single time ("7 PM") is a START time only and deliberately
 * returns `null` — per spec, a start-only time falls back to end-of-day
 * rather than expiring the moment the event begins.
 */
function parseEventEndTime(timeStr: string): ResolvedEndTime | null {
  const raw = timeStr.trim();
  if (!raw || /tba|see listing/i.test(raw)) return null;

  const rangeMatch = raw.match(
    /(\d{1,2})(?::(\d{2}))?\s*(?:[AaPp][Mm])?\s*[–—-]\s*(\d{1,2})(?::(\d{2}))?\s*([AaPp][Mm])/
  );
  if (!rangeMatch) return null;

  let hour = Number(rangeMatch[3]) % 12;
  const minute = rangeMatch[4] ? Number(rangeMatch[4]) : 0;
  const meridiem = rangeMatch[5].toLowerCase();
  if (meridiem === "pm") hour += 12;
  return { hour, minute };
}

/**
 * Resolves the ISO timestamp an event actually ends, or `null` when
 * Kindred simply doesn't have enough information to say (e.g. "Date
 * TBA") — callers should treat `null` as "don't auto-expire this."
 */
export function resolveEventEndsAt(
  dateStr: string | null | undefined,
  timeStr: string | null | undefined,
  now: Date = new Date()
): string | null {
  const span = parseEventDateSpan(dateStr ?? "", now);
  if (!span) return null;

  const year = inferYear(span.endMonth, span.endDay, now);
  const endTime = parseEventEndTime(timeStr ?? "");

  // No explicit end time → end of day, in the device's (== the event's,
  // for a hyper-local paper) local timezone, per the "date but no end
  // time" and "start time but no end time" fallback rules.
  const hour = endTime?.hour ?? 23;
  const minute = endTime?.minute ?? 59;
  const second = endTime ? 0 : 59;

  const resolved = new Date(year, span.endMonth, span.endDay, hour, minute, second);
  if (Number.isNaN(resolved.getTime())) return null;
  return resolved.toISOString();
}

/** Has this event already ended, regardless of the 30-day grace period? */
export function isPastEvent(
  eventEndsAt: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!eventEndsAt) return false;
  const end = new Date(eventEndsAt).getTime();
  if (Number.isNaN(end)) return false;
  return now.getTime() > end;
}

/** Has the 30-day post-event grace period fully elapsed? */
export function isEventExpired(
  eventEndsAt: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!eventEndsAt) return false;
  const end = new Date(eventEndsAt).getTime();
  if (Number.isNaN(end)) return false;
  return now.getTime() - end >= EVENT_CLIPPING_GRACE_MS;
}
