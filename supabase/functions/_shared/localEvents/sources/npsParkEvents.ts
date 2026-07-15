/**
 * NPS park events — official National Park Service programming near the reader.
 */

import { fetchNpsParks, isNpsConfigured } from "../../nps/npsProvider.ts";
import type { LocalEvent, LocalEventLocation } from "../provider.ts";
import { inferEventCategory } from "../provider.ts";
import { buildEventBadgeSignals, resolveEventBadges } from "../badgeResolver.ts";

function formatNpsSchedule(begin: string | null, end: string | null): string {
  const start = begin?.trim();
  const finish = end?.trim();
  if (start && finish && start !== finish) return `${start} – ${finish}`;
  if (start) return start;
  return "This week";
}

export async function fetchNpsParkEvents(
  location: LocalEventLocation
): Promise<LocalEvent[]> {
  if (!isNpsConfigured()) return [];
  if (!Number.isFinite(location.lat) || !Number.isFinite(location.lon)) return [];

  const parks = await fetchNpsParks({
    lat: location.lat,
    lon: location.lon,
    state: location.state ?? undefined,
    limit: 10,
    radiusMiles: 120,
  });

  const out: LocalEvent[] = [];
  const city = location.city?.trim() || "Nearby";

  for (const park of parks) {
    if (!park.events?.length) continue;
    for (const event of park.events) {
      const name = event.title?.trim();
      if (!name || name.length < 4) continue;

      const venue = park.fullName;
      const startDateTime = formatNpsSchedule(event.beginDate, event.endDate);
      const sourceUrl = event.url?.trim() || park.url;
      const category = inferEventCategory(name, venue);
      const badgeSignals = buildEventBadgeSignals({
        name,
        venue,
        date: startDateTime,
        time: "See listing",
        category,
        description: event.description ?? null,
        hasTicketListing: false,
        ticketLinkType: null,
        ticketProviders: [],
        priceText: event.isFree ? "Free" : null,
        extractedPrice: event.isFree ? 0 : null,
        parkingInfo: null,
      });
      const badges = resolveEventBadges(badgeSignals);

      out.push({
        name,
        startDateTime,
        venue,
        city,
        sourceUrl,
        sourceName: "National Park Service",
        sourceId: "nps_park_events",
        sourceTier: "official",
        imageUrl: park.imageUrl,
        imageSource: park.imageUrl ? "provider_thumbnail" : null,
        category,
        badges: badges.length ? badges : undefined,
        badgeSignals,
      });
    }
  }

  console.log("[localEvents:nps] gathered park events", {
    parkCount: parks.length,
    eventCount: out.length,
    city,
  });

  return out;
}
