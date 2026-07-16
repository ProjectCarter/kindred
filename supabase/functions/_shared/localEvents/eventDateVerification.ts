/**
 * Strict event date verification — Kindred never publishes past or uncertain events.
 * Every event must pass this gate before ranking and again before edition persistence.
 */

import { EVENT_HORIZON_DAYS, parseEventStartDate } from "./horizon.ts";
import type { LocalEvent, LocalEventLocation } from "./provider.ts";
import {
  compareZonedParts,
  endOfLocalDay,
  instantInTimeZone,
  resolveEventTimezone,
  zonedPartsFromDate,
  type ZonedDateTimeParts,
} from "./eventTimezone.ts";

export type EventDateSourceType =
  | "official_organizer_page"
  | "official_venue_calendar"
  | "official_ticketing_page"
  | "trusted_secondary_listing"
  | "unknown";

export type EventDateVerificationStatus = "verified" | "rejected";

export type EventDateRejectionReason =
  | "missing_start_datetime"
  | "expired_end_before_now"
  | "expired_start_before_now"
  | "beyond_horizon"
  | "missing_year"
  | "inferred_year"
  | "ambiguous_date"
  | "forbidden_date_source"
  | "source_date_conflict"
  | "secondary_unverified"
  | "cancelled"
  | "postponed"
  | "rescheduled_no_date"
  | "registration_closed"
  | "recurring_no_occurrence"
  | "unparseable_schedule";

export type EventDateVerification = {
  verifiedStartDateTime: string | null;
  verifiedEndDateTime: string | null;
  eventTimezone: string;
  dateSourceUrl: string | null;
  dateSourceType: EventDateSourceType;
  verifiedAt: string;
  verificationStatus: EventDateVerificationStatus;
  rejectionReason: EventDateRejectionReason | null;
};

export type EventDateVerificationContext = {
  /** Wall clock for expiration checks — real time, not edition midnight. */
  now: Date;
  /** Reader/event location for timezone resolution. */
  location?: Pick<LocalEventLocation, "state"> | null;
  /** Override IANA timezone when known from provider. */
  eventTimezone?: string | null;
  /** Edition calendar day (YYYY-MM-DD) for recurring occurrence resolution. */
  editionDate?: string | null;
};

const FORBIDDEN_DATE_PATTERN =
  /\b(published|publication date|posted on|last updated|updated on|modified on|crawl date|indexed|search result|article date|blog post|newsletter sent)\b/i;

const CANCELLED_PATTERN =
  /\b(cancelled|canceled|cancellation|called off|will not take place|not happening)\b/i;

const POSTPONED_PATTERN =
  /\b(postponed|postponement|delayed until further notice|tbd|to be determined|date tba)\b/i;

const RESCHEDULED_NO_DATE_PATTERN =
  /\b(rescheduled|moved to a later date|new date (?:to be )?announced)\b/i;

const REGISTRATION_CLOSED_PATTERN =
  /\b(registration closed|sold out|no longer accepting registrations|sign-ups closed|sales ended)\b/i;

const RECURRING_GENERIC_PATTERN =
  /\b(every (?:day|week|month|year|weekend|saturday|sunday|monday|tuesday|wednesday|thursday|friday)|weekly|monthly|recurring series|ongoing series|regular(?:ly)?)\b/i;

const RECURRING_FAVORITE_PATTERN =
  /\b(annual|tradition|farmers market|symphony season|recurring)\b/i;

const AMBIGUOUS_SCHEDULE_PATTERN =
  /^(this week|see listing|date tba|time tba|date tba time tba|tba|schedule varies|check website|multiple dates)$/i;

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function isoDateOnly(value: string | null | undefined): string | null {
  const match = value?.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

function parseTime24h(value: string | null | undefined): {
  hour: number;
  minute: number;
} | null {
  const raw = value?.trim();
  if (!raw) return null;
  const match24 = raw.match(/^(\d{1,2}):(\d{2})/);
  if (match24) {
    const hour = Number(match24[1]);
    const minute = Number(match24[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { hour, minute };
    }
  }
  const match12 = raw.match(
    /(\d{1,2})(?::(\d{2}))?\s*([AaPp][Mm])/
  );
  if (match12) {
    let hour = Number(match12[1]) % 12;
    const minute = match12[2] ? Number(match12[2]) : 0;
    if (match12[3].toLowerCase() === "pm") hour += 12;
    return { hour, minute };
  }
  return null;
}

function parseTimeFromScheduleText(
  startDateTime: string
): { hour: number; minute: number } | null {
  const raw = startDateTime.trim();
  const rangeEnd = raw.match(
    /[–—-]\s*(\d{1,2})(?::(\d{2}))?\s*([AaPp][Mm])\s*$/
  );
  if (rangeEnd) {
    let hour = Number(rangeEnd[1]) % 12;
    const minute = rangeEnd[2] ? Number(rangeEnd[2]) : 0;
    if (rangeEnd[3].toLowerCase() === "pm") hour += 12;
    return { hour, minute };
  }
  const single = raw.match(/(\d{1,2})(?::(\d{2}))?\s*([AaPp][Mm])\b/);
  if (single) {
    let hour = Number(single[1]) % 12;
    const minute = single[2] ? Number(single[2]) : 0;
    if (single[3].toLowerCase() === "pm") hour += 12;
    return { hour, minute };
  }
  return null;
}

function parseEndFromScheduleRange(
  startDateTime: string,
  startYear: number,
  startMonth: number,
  startDay: number
): ZonedDateTimeParts | null {
  const raw = startDateTime.trim();
  const rangeMatch = raw.match(
    /([A-Za-z]{3,9})\.?\s+(\d{1,2})\s*(?:st|nd|rd|th)?\s*[–—-]\s*(?:([A-Za-z]{3,9})\.?\s+)?(\d{1,2})\s*(?:st|nd|rd|th)?(?:\s*[·,]\s*|\s+)(\d{1,2}(?::\d{2})?\s*[AaPp][Mm]\s*[–—-]\s*\d{1,2}(?::\d{2})?\s*[AaPp][Mm])?/i
  );
  if (!rangeMatch) return null;

  const endMonthName = (rangeMatch[3] ?? rangeMatch[1]).toLowerCase();
  const endMonth = MONTHS[endMonthName];
  const endDay = Number(rangeMatch[4]);
  if (!endMonth || !Number.isFinite(endDay)) return null;

  let endYear = startYear;
  if (endMonth < startMonth || (endMonth === startMonth && endDay < startDay)) {
    endYear += 1;
  }

  const endTime = parseTimeFromScheduleText(raw);
  return {
    year: endYear,
    month: endMonth,
    day: endDay,
    hour: endTime?.hour ?? 23,
    minute: endTime?.minute ?? 59,
    second: endTime ? 0 : 59,
  };
}

function hasExplicitYear(
  event: LocalEvent,
  startDateTime: string
): boolean {
  if (isoDateOnly(event.startDateIso)) return true;
  if (isoDateOnly(startDateTime)) return true;
  if (/\b(19|20)\d{2}\b/.test(startDateTime)) return true;
  if (isoDateOnly(event.endDateIso)) return true;
  return false;
}

function yearWasInferred(event: LocalEvent, reference: Date): boolean {
  if (hasExplicitYear(event, event.startDateTime)) return false;
  const parsed = parseEventStartDate(
    event.startDateTime,
    event.startDateIso,
    reference
  );
  return parsed != null;
}

function resolveDateSourceType(event: LocalEvent): EventDateSourceType {
  if (event.dateSourceType) return event.dateSourceType;

  const url = `${event.sourceUrl} ${event.officialWebsite ?? ""}`.toLowerCase();
  const sourceId = event.sourceId ?? "";

  if (
    event.sourceTier === "official" ||
    sourceId === "nps_park_events" ||
    /\.gov\b|nps\.gov/.test(url)
  ) {
    if (/eventbrite|ticketmaster|axs|dice|seatgeek|stubhub/.test(url)) {
      return "official_ticketing_page";
    }
    return "official_organizer_page";
  }

  if (event.sourceTier === "venue") {
    return "official_venue_calendar";
  }

  if (/eventbrite|ticketmaster|axs|dice|seatgeek|stubhub/.test(url)) {
    return "official_ticketing_page";
  }

  if (sourceId === "serp_google_events") {
    return "trusted_secondary_listing";
  }

  return "unknown";
}

function resolveDateSourceUrl(
  event: LocalEvent,
  sourceType: EventDateSourceType
): string | null {
  if (event.dateSourceUrl?.trim()) return event.dateSourceUrl.trim();
  if (
    sourceType === "official_organizer_page" ||
    sourceType === "official_venue_calendar"
  ) {
    return event.officialWebsite?.trim() || event.sourceUrl?.trim() || null;
  }
  return event.sourceUrl?.trim() || null;
}

function isSecondarySource(sourceType: EventDateSourceType): boolean {
  return (
    sourceType === "trusted_secondary_listing" || sourceType === "unknown"
  );
}

function secondarySourceCorroborated(event: LocalEvent): boolean {
  if (event.dateSourceConflict) return false;
  const official = event.officialWebsite?.trim();
  if (!official) return false;
  if (/eventbrite|google\.com|serpapi|facebook\.com\/events/i.test(official)) {
    return false;
  }
  return true;
}

function scheduleHaystack(event: LocalEvent): string {
  return [
    event.name,
    event.startDateTime,
    event.banditNote ?? "",
    event.venue,
  ]
    .filter(Boolean)
    .join(" ");
}

function isForbiddenDateSource(startDateTime: string): boolean {
  return FORBIDDEN_DATE_PATTERN.test(startDateTime);
}

function isAmbiguousSchedule(startDateTime: string): boolean {
  const raw = startDateTime.trim();
  if (!raw) return true;
  if (AMBIGUOUS_SCHEDULE_PATTERN.test(raw)) return true;
  if (/^time tba$/i.test(raw)) return true;
  return false;
}

function isGenericRecurringWithoutOccurrence(
  event: LocalEvent,
  hasConcreteStart: boolean
): boolean {
  const hay = scheduleHaystack(event);
  if (hasConcreteStart && !RECURRING_GENERIC_PATTERN.test(hay)) return false;
  if (
    RECURRING_GENERIC_PATTERN.test(hay) &&
    !isoDateOnly(event.startDateIso) &&
    !parseTimeFromScheduleText(event.startDateTime)
  ) {
    return true;
  }
  if (
    RECURRING_FAVORITE_PATTERN.test(hay) &&
    !isoDateOnly(event.startDateIso) &&
    !/\b\d{4}\b/.test(event.startDateTime) &&
    !parseEventStartDate(event.startDateTime, null, new Date())
  ) {
    return true;
  }
  return false;
}

type ParsedSchedule = {
  start: ZonedDateTimeParts;
  end: ZonedDateTimeParts | null;
  allDay: boolean;
  /** True when provider or schedule text supplied an explicit end. */
  hasExplicitEnd: boolean;
};

function buildParsedSchedule(
  event: LocalEvent,
  timeZone: string,
  reference: Date
): ParsedSchedule | null {
  const startIso = isoDateOnly(event.startDateIso);
  const endIso = isoDateOnly(event.endDateIso);
  const startTime =
    parseTime24h(event.startTimeIso) ??
    parseTimeFromScheduleText(event.startDateTime);
  const endTime =
    parseTime24h(event.endTimeIso) ??
    (event.startDateTime.includes("–") || event.startDateTime.includes("-")
      ? parseTimeFromScheduleText(event.startDateTime)
      : null);

  if (startIso) {
    const [y, m, d] = startIso.split("-").map(Number);
    const allDay = !startTime && !event.startTimeIso?.trim();
    const start: ZonedDateTimeParts = {
      year: y,
      month: m,
      day: d,
      hour: allDay ? 0 : (startTime?.hour ?? 0),
      minute: allDay ? 0 : (startTime?.minute ?? 0),
      second: 0,
    };

    let end: ZonedDateTimeParts | null = null;
    if (endIso) {
      const [ey, em, ed] = endIso.split("-").map(Number);
      const endAllDay = !endTime && !event.endTimeIso?.trim();
      end = {
        year: ey,
        month: em,
        day: ed,
        hour: endAllDay ? 23 : (endTime?.hour ?? 23),
        minute: endAllDay ? 59 : (endTime?.minute ?? 59),
        second: endAllDay ? 59 : 0,
      };
    } else if (!allDay && endTime && startTime) {
      end = {
        ...start,
        hour: endTime.hour,
        minute: endTime.minute,
        second: 0,
      };
      if (compareZonedParts(end, start) <= 0) {
        end = { ...end, day: end.day + 1 };
      }
    } else {
      end = parseEndFromScheduleRange(
        event.startDateTime,
        y,
        m,
        d
      );
    }

    const hasExplicitEnd = Boolean(
      endIso || event.endTimeIso?.trim() || parseEndFromScheduleRange(
        event.startDateTime,
        y,
        m,
        d
      )
    );

    if (allDay && !end) {
      end = {
        year: y,
        month: m,
        day: d,
        hour: 23,
        minute: 59,
        second: 59,
      };
    }

    return { start, end, allDay, hasExplicitEnd };
  }

  const parsedDate = parseEventStartDate(
    event.startDateTime,
    null,
    reference
  );
  if (!parsedDate) return null;

  const startTimeFromText = parseTimeFromScheduleText(event.startDateTime);
  const allDay = !startTimeFromText;
  const start: ZonedDateTimeParts = {
    year: parsedDate.getFullYear(),
    month: parsedDate.getMonth() + 1,
    day: parsedDate.getDate(),
    hour: allDay ? 0 : (startTimeFromText?.hour ?? 0),
    minute: allDay ? 0 : (startTimeFromText?.minute ?? 0),
    second: 0,
  };

  const rangeEnd = parseEndFromScheduleRange(
    event.startDateTime,
    start.year,
    start.month,
    start.day
  );
  const hasExplicitEnd = Boolean(rangeEnd);
  let end = rangeEnd ??
    (allDay
      ? {
          year: start.year,
          month: start.month,
          day: start.day,
          hour: 23,
          minute: 59,
          second: 59,
        }
      : null);

  return { start, end, allDay, hasExplicitEnd };
}

function toIsoInstant(parts: ZonedDateTimeParts, timeZone: string): string {
  return instantInTimeZone(parts, timeZone).toISOString();
}

function reject(
  reason: EventDateRejectionReason,
  timeZone: string,
  sourceType: EventDateSourceType,
  sourceUrl: string | null,
  verifiedAt: string
): EventDateVerification {
  return {
    verifiedStartDateTime: null,
    verifiedEndDateTime: null,
    eventTimezone: timeZone,
    dateSourceUrl: sourceUrl,
    dateSourceType: sourceType,
    verifiedAt,
    verificationStatus: "rejected",
    rejectionReason: reason,
  };
}

/** Verify a single event schedule — attach metadata, never guess past dates. */
export function verifyEventDate(
  event: LocalEvent,
  context: EventDateVerificationContext
): EventDateVerification {
  const verifiedAt = context.now.toISOString();
  const timeZone = resolveEventTimezone(
    context.location,
    context.eventTimezone ?? event.eventTimezone
  );
  const sourceType = resolveDateSourceType(event);
  const sourceUrl = resolveDateSourceUrl(event, sourceType);
  const schedule = event.startDateTime?.trim() ?? "";

  if (!schedule || isAmbiguousSchedule(schedule)) {
    return reject(
      "missing_start_datetime",
      timeZone,
      sourceType,
      sourceUrl,
      verifiedAt
    );
  }

  if (isForbiddenDateSource(schedule)) {
    return reject(
      "forbidden_date_source",
      timeZone,
      sourceType,
      sourceUrl,
      verifiedAt
    );
  }

  if (
    RECURRING_GENERIC_PATTERN.test(schedule) &&
    !isoDateOnly(event.startDateIso)
  ) {
    return reject(
      "recurring_no_occurrence",
      timeZone,
      sourceType,
      sourceUrl,
      verifiedAt
    );
  }

  const hay = scheduleHaystack(event);
  if (CANCELLED_PATTERN.test(hay)) {
    return reject("cancelled", timeZone, sourceType, sourceUrl, verifiedAt);
  }
  if (POSTPONED_PATTERN.test(hay)) {
    return reject("postponed", timeZone, sourceType, sourceUrl, verifiedAt);
  }
  if (
    RESCHEDULED_NO_DATE_PATTERN.test(hay) &&
    !isoDateOnly(event.startDateIso)
  ) {
    return reject(
      "rescheduled_no_date",
      timeZone,
      sourceType,
      sourceUrl,
      verifiedAt
    );
  }
  if (REGISTRATION_CLOSED_PATTERN.test(hay)) {
    return reject(
      "registration_closed",
      timeZone,
      sourceType,
      sourceUrl,
      verifiedAt
    );
  }

  if (event.dateSourceConflict) {
    return reject(
      "source_date_conflict",
      timeZone,
      sourceType,
      sourceUrl,
      verifiedAt
    );
  }

  if (isSecondarySource(sourceType) && !secondarySourceCorroborated(event)) {
    return reject(
      "secondary_unverified",
      timeZone,
      sourceType,
      sourceUrl,
      verifiedAt
    );
  }

  if (!hasExplicitYear(event, schedule)) {
    if (yearWasInferred(event, context.now)) {
      return reject(
        "inferred_year",
        timeZone,
        sourceType,
        sourceUrl,
        verifiedAt
      );
    }
    return reject("missing_year", timeZone, sourceType, sourceUrl, verifiedAt);
  }

  const parsed = buildParsedSchedule(event, timeZone, context.now);
  if (!parsed) {
    if (isGenericRecurringWithoutOccurrence(event, false)) {
      return reject(
        "recurring_no_occurrence",
        timeZone,
        sourceType,
        sourceUrl,
        verifiedAt
      );
    }
    return reject(
      "unparseable_schedule",
      timeZone,
      sourceType,
      sourceUrl,
      verifiedAt
    );
  }

  if (isGenericRecurringWithoutOccurrence(event, true)) {
    return reject(
      "recurring_no_occurrence",
      timeZone,
      sourceType,
      sourceUrl,
      verifiedAt
    );
  }

  const horizonLimit = new Date(context.now);
  horizonLimit.setDate(horizonLimit.getDate() + EVENT_HORIZON_DAYS);
  const horizonParts = zonedPartsFromDate(horizonLimit, timeZone);

  if (compareZonedParts(parsed.start, horizonParts) > 0) {
    return reject("beyond_horizon", timeZone, sourceType, sourceUrl, verifiedAt);
  }

  const startInstant = instantInTimeZone(parsed.start, timeZone);
  const allDayEnd = parsed.allDay
    ? endOfLocalDay(
        parsed.start.year,
        parsed.start.month,
        parsed.start.day,
        timeZone
      )
    : null;
  const endInstant = parsed.hasExplicitEnd && parsed.end
    ? instantInTimeZone(parsed.end, timeZone)
    : allDayEnd;

  if (parsed.hasExplicitEnd && endInstant) {
    if (endInstant.getTime() <= context.now.getTime()) {
      return reject(
        "expired_end_before_now",
        timeZone,
        sourceType,
        sourceUrl,
        verifiedAt
      );
    }
  } else if (parsed.allDay && allDayEnd) {
    if (allDayEnd.getTime() <= context.now.getTime()) {
      return reject(
        "expired_end_before_now",
        timeZone,
        sourceType,
        sourceUrl,
        verifiedAt
      );
    }
  } else if (startInstant.getTime() < context.now.getTime()) {
    return reject(
      "expired_start_before_now",
      timeZone,
      sourceType,
      sourceUrl,
      verifiedAt
    );
  }

  return {
    verifiedStartDateTime: toIsoInstant(parsed.start, timeZone),
    verifiedEndDateTime: endInstant ? endInstant.toISOString() : null,
    eventTimezone: timeZone,
    dateSourceUrl: sourceUrl,
    dateSourceType: sourceType,
    verifiedAt,
    verificationStatus: "verified",
    rejectionReason: null,
  };
}

export function attachEventDateVerification(
  event: LocalEvent,
  context: EventDateVerificationContext
): LocalEvent {
  const dateVerification = verifyEventDate(event, context);
  return {
    ...event,
    eventTimezone: dateVerification.eventTimezone,
    dateVerification,
  };
}

export function isEventDateVerified(event: LocalEvent): boolean {
  return event.dateVerification?.verificationStatus === "verified";
}

export type EventDateVerificationBatchResult = {
  verified: LocalEvent[];
  rejected: Array<{
    name: string;
    sourceUrl: string;
    reason: EventDateRejectionReason;
  }>;
};

/** Filter to verified events only — used in pipeline and pre-publish gate. */
export function filterVerifiedEventsForEdition(
  events: LocalEvent[],
  context: EventDateVerificationContext
): EventDateVerificationBatchResult {
  const verified: LocalEvent[] = [];
  const rejected: EventDateVerificationBatchResult["rejected"] = [];

  for (const event of events) {
    const checked = attachEventDateVerification(event, context);
    if (isEventDateVerified(checked)) {
      verified.push(checked);
    } else {
      const reason =
        checked.dateVerification?.rejectionReason ?? "unparseable_schedule";
      rejected.push({
        name: checked.name,
        sourceUrl: checked.sourceUrl,
        reason,
      });
      console.log("[localEvents:dateVerification] rejected", {
        name: checked.name.slice(0, 60),
        reason,
        schedule: checked.startDateTime,
        source: checked.sourceId,
      });
    }
  }

  return { verified, rejected };
}

/** Final publish gate — re-run expiration against the wall clock. */
export function assertEventsVerifiedForPublication(
  events: LocalEvent[],
  context: EventDateVerificationContext
): LocalEvent[] {
  const { verified, rejected } = filterVerifiedEventsForEdition(events, context);
  if (rejected.length > 0) {
    console.log("[localEvents:dateVerification] publish gate removed", {
      removed: rejected.length,
      sample: rejected.slice(0, 5),
    });
  }
  return verified;
}

export { EVENT_HORIZON_DAYS };
