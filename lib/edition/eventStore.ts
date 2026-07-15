import type { LocalEventCard } from "./localEvents";
import {
  HORIZON_BUCKET_LABEL,
  resolveCardHorizon,
} from "./eventHorizon";

/**
 * In-memory handoff for the event detail screen.
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

export type EventBadge =
  | "Today"
  | "This Weekend"
  | "Next Weekend"
  | "Coming Soon";

/** Derive a small editorial badge from the 30-day horizon — never invent signals. */
export function deriveEventBadge(
  event: LocalEventCard,
  now: Date = new Date()
): EventBadge | null {
  const bucket = resolveCardHorizon(event, now);
  if (bucket === "beyond") return null;

  if (bucket === "today") return "Today";

  const label = HORIZON_BUCKET_LABEL[bucket];
  if (label === "This Weekend") return "This Weekend";
  if (label === "Next Weekend") return "Next Weekend";
  if (label === "Coming Soon") return "Coming Soon";

  const hay = `${event.name} ${event.date} ${event.time}`.toLowerCase();
  if (/\b(tonight|this evening)\b/i.test(hay)) return "Today";

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
