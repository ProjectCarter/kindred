/**
 * Local Events horizon — forward-looking newspaper, not a same-day feed.
 * Classifies events into editorial buckets for the next 30 days.
 */

import type { LocalEvent } from "./provider.ts";

export const EVENT_HORIZON_DAYS = 30;

export type EventHorizonBucket =
  | "today"
  | "this_weekend"
  | "next_weekend"
  | "coming_soon"
  | "beyond";

export const HORIZON_BUCKET_LABEL: Record<
  Exclude<EventHorizonBucket, "beyond">,
  string
> = {
  today: "Happening Today",
  this_weekend: "This Weekend",
  next_weekend: "Next Weekend",
  coming_soon: "Coming Soon",
};

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

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function daysBetween(from: Date, to: Date): number {
  const ms = startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

function parseIsoDateOnly(value: string): Date | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  const d = new Date(year, month, day);
  if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) {
    return null;
  }
  return d;
}

function resolveMonthDay(
  monthToken: string,
  day: number,
  reference: Date
): Date | null {
  const month = MONTHS[monthToken.toLowerCase()];
  if (month == null || !Number.isFinite(day) || day < 1 || day > 31) return null;

  let year = reference.getFullYear();
  const candidate = new Date(year, month, day);
  if (candidate < startOfLocalDay(reference)) {
    candidate.setFullYear(year + 1);
  }
  if (candidate.getMonth() !== month || candidate.getDate() !== day) return null;
  return candidate;
}

/** Best-effort parse from provider schedule text — never fabricates precision. */
export function parseEventStartDate(
  startDateTime: string,
  startDateIso?: string | null,
  reference: Date = new Date()
): Date | null {
  const iso = startDateIso?.trim();
  if (iso) {
    const parsed = parseIsoDateOnly(iso);
    if (parsed) return parsed;
  }

  const raw = startDateTime.trim().toLowerCase();
  if (!raw || raw === "time tba" || raw === "date tba") return null;

  const ref = startOfLocalDay(reference);
  if (/\btoday\b/.test(raw)) return ref;
  if (/\btomorrow\b/.test(raw)) {
    const d = new Date(ref);
    d.setDate(d.getDate() + 1);
    return d;
  }

  const isoInline = parseIsoDateOnly(startDateTime);
  if (isoInline) return isoInline;

  const slash = raw.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (slash) {
    const month = Number(slash[1]) - 1;
    const day = Number(slash[2]);
    let year = slash[3] ? Number(slash[3]) : reference.getFullYear();
    if (year < 100) year += 2000;
    const d = new Date(year, month, day);
    if (d.getMonth() === month && d.getDate() === day) {
      if (d < ref && !slash[3]) d.setFullYear(year + 1);
      return d;
    }
  }

  const named = raw.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:,?\s*(\d{4}))?/i
  );
  if (named) {
    const monthToken = named[1];
    const day = Number(named[2]);
    const explicitYear = named[3] ? Number(named[3]) : null;
    if (explicitYear) {
      const month = MONTHS[monthToken.toLowerCase()];
      if (month != null) {
        const d = new Date(explicitYear, month, day);
        if (d.getMonth() === month && d.getDate() === day) return d;
      }
    }
    return resolveMonthDay(monthToken, day, reference);
  }

  const weekday = raw.match(/\b(sun|mon|tue|wed|thu|fri|sat)\b/);
  if (weekday) {
    const target = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(
      weekday[1]
    );
    if (target >= 0) {
      const d = new Date(ref);
      const current = d.getDay();
      let delta = (target - current + 7) % 7;
      if (delta === 0 && !raw.includes(String(reference.getDate()))) {
        delta = 7;
      }
      d.setDate(d.getDate() + delta);
      return d;
    }
  }

  return null;
}

function weekendSaturday(reference: Date): Date {
  const d = startOfLocalDay(reference);
  const day = d.getDay();
  const daysUntilSaturday = (6 - day + 7) % 7;
  d.setDate(d.getDate() + daysUntilSaturday);
  return d;
}

function isDateInRange(date: Date, start: Date, end: Date): boolean {
  const t = startOfLocalDay(date).getTime();
  return t >= startOfLocalDay(start).getTime() && t <= startOfLocalDay(end).getTime();
}

export function classifyEventHorizon(
  eventDate: Date | null,
  reference: Date = new Date()
): EventHorizonBucket {
  if (!eventDate) return "coming_soon";

  const ref = startOfLocalDay(reference);
  const daysOut = daysBetween(ref, eventDate);
  if (daysOut < 0 || daysOut > EVENT_HORIZON_DAYS) return "beyond";
  if (daysOut === 0) return "today";

  const thisSat = weekendSaturday(ref);
  const thisSun = new Date(thisSat);
  thisSun.setDate(thisSun.getDate() + 1);

  if (isDateInRange(eventDate, thisSat, thisSun)) return "this_weekend";

  const nextSat = new Date(thisSat);
  nextSat.setDate(nextSat.getDate() + 7);
  const nextSun = new Date(nextSat);
  nextSun.setDate(nextSun.getDate() + 1);

  if (isDateInRange(eventDate, nextSat, nextSun)) return "next_weekend";

  return "coming_soon";
}

export function resolveEventHorizon(
  event: Pick<LocalEvent, "startDateTime" | "startDateIso">,
  reference: Date = new Date()
): EventHorizonBucket {
  const parsed = parseEventStartDate(
    event.startDateTime,
    event.startDateIso,
    reference
  );
  return classifyEventHorizon(parsed, reference);
}

export function attachEventHorizon(
  event: LocalEvent,
  reference: Date = new Date()
): LocalEvent {
  const startDateIso =
    event.startDateIso ??
    (() => {
      const parsed = parseEventStartDate(event.startDateTime, null, reference);
      if (!parsed) return null;
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, "0");
      const d = String(parsed.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    })();

  return {
    ...event,
    startDateIso,
    horizonBucket: resolveEventHorizon(
      { startDateTime: event.startDateTime, startDateIso },
      reference
    ),
  };
}

export function isWithinEventHorizon(
  event: Pick<LocalEvent, "startDateTime" | "startDateIso" | "horizonBucket">,
  reference: Date = new Date()
): boolean {
  const bucket =
    event.horizonBucket ??
    resolveEventHorizon(event, reference);
  return bucket !== "beyond";
}
