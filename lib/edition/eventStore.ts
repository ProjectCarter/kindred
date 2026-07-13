import type { LocalEventCard } from "./localEvents";

/**
 * In-memory handoff for the event detail screen.
 * Same pattern as articleStore — Router params are too small for full cards.
 */
const MAX_STASHED = 16;
const store = new Map<string, LocalEventCard>();

function eventId(event: LocalEventCard): string {
  const raw = `${event.name}|${event.date}|${event.venue}|${event.sourceUrl}`;
  return `evt_${raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 72)}`;
}

function touch(id: string, event: LocalEventCard): void {
  store.delete(id);
  store.set(id, event);
  while (store.size > MAX_STASHED) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

export function stashEvent(event: LocalEventCard): string {
  const id = eventId(event);
  touch(id, event);
  return id;
}

export function getStashedEvent(id: string): LocalEventCard | null {
  const event = store.get(id);
  if (!event) return null;
  touch(id, event);
  return event;
}

export type EventBadge = "Today" | "Free" | "Starts Soon";

/** Derive a small editorial badge from schedule text — never invent “Free” without signal. */
export function deriveEventBadge(
  event: LocalEventCard,
  now: Date = new Date()
): EventBadge | null {
  const hay = `${event.name} ${event.date} ${event.time}`.toLowerCase();
  if (/\bfree\b/.test(hay)) return "Free";

  const todayLabel = now.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const todayLong = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const dateLower = event.date.toLowerCase();
  if (
    /\btoday\b/i.test(event.date) ||
    dateLower.includes(todayLabel.toLowerCase()) ||
    dateLower.includes(
      now.toLocaleDateString(undefined, { month: "short", day: "numeric" }).toLowerCase()
    ) ||
    dateLower.includes(todayLong.toLowerCase())
  ) {
    return "Today";
  }

  // “Starts Soon” — same calendar day language or evening window in the when-string.
  if (/\b(tonight|this evening|starts soon)\b/i.test(hay)) return "Starts Soon";

  return null;
}

/** Neighborhood line — venue when it reads local; else city. */
export function eventPlaceLine(event: LocalEventCard): string {
  const venue = event.venue?.trim();
  const city = event.city?.trim();
  if (venue && city && !venue.toLowerCase().includes(city.toLowerCase())) {
    return `${venue} · ${city}`;
  }
  return venue || city || "Nearby";
}
