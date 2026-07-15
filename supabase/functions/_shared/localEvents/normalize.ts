/**
 * Normalize event records after multi-source gather — dates, URLs, provenance.
 */

import type { LocalEvent } from "./provider.ts";
import { inferEventCategory } from "./provider.ts";
import { normalizeOfficialWebsite } from "./officialWebsite.ts";

const OFFICIAL_URL_PATTERN =
  /\.gov|\.edu|nps\.gov|library|museum|botanical|zoo|aquarium|parks?\.|recreation|visitor|tourism|chamber|arts\.org/i;

const AGGREGATOR_PATTERN =
  /eventbrite|ticketmaster|axs\.com|feverup|dice\.fm|meetup|facebook\.com\/events/i;

function inferSourceTier(event: LocalEvent): LocalEvent["sourceTier"] {
  if (event.sourceTier) return event.sourceTier;
  const blob = `${event.sourceUrl} ${event.sourceName} ${event.sourceId ?? ""}`.toLowerCase();
  if (event.sourceId === "nps_park_events" || OFFICIAL_URL_PATTERN.test(blob)) {
    return "official";
  }
  if (AGGREGATOR_PATTERN.test(blob)) return "aggregator";
  return "venue";
}

function inferSourceId(event: LocalEvent): string {
  if (event.sourceId) return event.sourceId;
  const url = event.sourceUrl.toLowerCase();
  if (url.includes("nps.gov")) return "nps_park_events";
  if (url.includes("eventbrite")) return "eventbrite";
  if (url.includes("ticketmaster")) return "ticketmaster";
  if (url.includes("axs.com")) return "axs";
  if (url.includes("feverup")) return "fever";
  return "serp_google_events";
}

/** Trim fields, infer category/source metadata, prefer official listing URLs. */
export function normalizeEventRecord(event: LocalEvent): LocalEvent {
  const name = event.name.replace(/\s+/g, " ").trim();
  const venue = event.venue.replace(/\s+/g, " ").trim() || "Venue TBA";
  const city = event.city.replace(/\s+/g, " ").trim();
  const sourceUrl = event.sourceUrl.trim();
  const sourceName = event.sourceName.trim() || "Event listing";
  let officialWebsite = normalizeOfficialWebsite(event.officialWebsite);
  if (!officialWebsite && event.sourceTier === "official") {
    officialWebsite = normalizeOfficialWebsite(sourceUrl);
  }
  const startDateTime = event.startDateTime.replace(/\s+/g, " ").trim() || "Date TBA";
  const category = event.category ?? inferEventCategory(name, venue);
  const sourceId = inferSourceId(event);
  const sourceTier = inferSourceTier({ ...event, sourceId });

  return {
    ...event,
    name,
    venue,
    city,
    sourceUrl,
    sourceName,
    ...(officialWebsite ? { officialWebsite } : {}),
    startDateTime,
    category,
    sourceId,
    sourceTier,
    imageUrl: event.imageUrl?.trim() || null,
    banditNote: event.banditNote?.trim() || null,
  };
}

export function normalizeEvents(events: LocalEvent[]): LocalEvent[] {
  return events.map(normalizeEventRecord);
}
