import type { LocalEventCard } from "./localEvents";

/**
 * In-memory handoff of today's full Local Events list, for the "See all N
 * events →" destination screen. Same reasoning as articleStore/eventStore —
 * router params are too small to carry a full list, and there's only ever
 * one "today" in play at a time, so a single slot (not a map) is enough.
 */
let todaysEvents: LocalEventCard[] = [];

export function stashTodaysEvents(events: LocalEventCard[]): void {
  todaysEvents = events;
}

export function getTodaysEvents(): LocalEventCard[] {
  return todaysEvents;
}
