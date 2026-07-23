/**
 * Local Events card validation — minimum fields for a trustworthy listing.
 * Images and long descriptions are optional.
 */

import type { LocalEventCard } from "./localEvents.ts";

export function isValidEventCard(event: LocalEventCard): boolean {
  const title = event.name?.trim();
  if (!title) return false;

  const venue = event.venue?.trim();
  const city = event.city?.trim();
  const hasLocation =
    Boolean(venue && venue !== "Venue TBA") || Boolean(city);

  const hasSource = Boolean(event.sourceUrl?.trim());

  // Schedule is preferred but not required — listings with Date/Time TBA
  // still belong when the provider gave a real title, place, and source.
  return hasLocation && hasSource;
}

export function filterValidEvents(events: LocalEventCard[]): {
  valid: LocalEventCard[];
  dropped: Array<{ event: LocalEventCard; reason: string }>;
} {
  const valid: LocalEventCard[] = [];
  const dropped: Array<{ event: LocalEventCard; reason: string }> = [];

  for (const event of events) {
    if (isValidEventCard(event)) {
      valid.push(event);
      continue;
    }
    const reasons: string[] = [];
    if (!event.name?.trim()) reasons.push("missing_title");
    const venue = event.venue?.trim();
    const city = event.city?.trim();
    if ((!venue || venue === "Venue TBA") && !city) {
      reasons.push("missing_location");
    }
    if (!event.sourceUrl?.trim()) reasons.push("missing_source_url");
    dropped.push({
      event,
      reason: reasons.join(", ") || "incomplete",
    });
  }

  if (__DEV__ && dropped.length > 0) {
    console.log("[localEvents:validation] dropped events", {
      droppedCount: dropped.length,
      samples: dropped.slice(0, 5).map((d) => ({
        name: d.event.name,
        reason: d.reason,
      })),
    });
  }

  return { valid, dropped };
}
