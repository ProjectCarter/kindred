/**
 * Client mirror — Local Events 30-day horizon buckets.
 */

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
  if (candidate < startOfLocalDay(reference)) candidate.setFullYear(year + 1);
  if (candidate.getMonth() !== month || candidate.getDate() !== day) return null;
  return candidate;
}

export function parseEventStartDate(
  schedule: string,
  startDateIso?: string | null,
  reference: Date = new Date()
): Date | null {
  const iso = startDateIso?.trim();
  if (iso) {
    const parsed = parseIsoDateOnly(iso);
    if (parsed) return parsed;
  }

  const raw = schedule.trim().toLowerCase();
  if (!raw || raw === "time tba" || raw === "date tba") return null;

  const ref = startOfLocalDay(reference);
  if (/\btoday\b/.test(raw)) return ref;
  if (/\btomorrow\b/.test(raw)) {
    const d = new Date(ref);
    d.setDate(d.getDate() + 1);
    return d;
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

export function resolveCardHorizon(
  event: { date: string; time?: string | null; startDateIso?: string | null; horizonBucket?: EventHorizonBucket | null },
  reference: Date = new Date()
): EventHorizonBucket {
  if (event.horizonBucket && event.horizonBucket !== "beyond") {
    return event.horizonBucket;
  }
  const schedule = `${event.date} ${event.time ?? ""}`.trim();
  const parsed = parseEventStartDate(schedule, event.startDateIso, reference);
  return classifyEventHorizon(parsed, reference);
}

const BUCKET_ORDER: Array<Exclude<EventHorizonBucket, "beyond">> = [
  "today",
  "this_weekend",
  "next_weekend",
  "coming_soon",
];

const BUCKET_GRID_TARGETS: Record<Exclude<EventHorizonBucket, "beyond">, number> = {
  today: 2,
  this_weekend: 2,
  next_weekend: 2,
  coming_soon: 2,
};

export function allocateEventsForGrid<T extends { date: string; time?: string | null; startDateIso?: string | null; horizonBucket?: EventHorizonBucket | null }>(
  events: T[],
  maxTotal: number,
  score: (event: T, bucket: EventHorizonBucket) => number,
  reference: Date = new Date()
): T[] {
  const scored = events
    .map((event) => ({
      event,
      bucket: resolveCardHorizon(event, reference),
      score: score(event, resolveCardHorizon(event, reference)),
    }))
    .filter((row) => row.bucket !== "beyond")
    .sort((a, b) => b.score - a.score);

  const byBucket = new Map<EventHorizonBucket, typeof scored>();
  for (const row of scored) {
    const list = byBucket.get(row.bucket) ?? [];
    list.push(row);
    byBucket.set(row.bucket, list);
  }

  const picked: T[] = [];
  const pickedKeys = new Set<string>();

  function tryPick(row: (typeof scored)[number]): boolean {
    if (picked.length >= maxTotal) return false;
    const key = `${row.event.date}|${(row.event as { name?: string }).name ?? ""}`.toLowerCase();
    if (pickedKeys.has(key)) return false;
    pickedKeys.add(key);
    picked.push(row.event);
    return true;
  }

  for (const bucket of BUCKET_ORDER) {
    const target = BUCKET_GRID_TARGETS[bucket];
    const pool = byBucket.get(bucket) ?? [];
    let added = 0;
    for (const row of pool) {
      if (added >= target) break;
      if (tryPick(row)) added += 1;
    }
  }

  for (const row of scored) {
    if (picked.length >= maxTotal) break;
    tryPick(row);
  }

  return picked;
}
