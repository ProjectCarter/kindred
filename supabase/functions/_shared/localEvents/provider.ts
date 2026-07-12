/**
 * Local events provider adapter — kept free of the full edition builder graph
 * so lightweight Edge Functions can refresh event photography without OOM.
 */

import { eventMatchesCity } from "../contentQuality.ts";

export type LocalEventLocation = {
  lat: number;
  lon: number;
  city: string;
  region?: string | null;
  state?: string | null;
};

export type LocalEvent = {
  name: string;
  startDateTime: string;
  venue: string;
  city: string;
  sourceUrl: string;
  sourceName: string;
  /** Authentic listing photograph when the provider supplies one. */
  imageUrl?: string | null;
  /** Provenance for the photograph — never invent stock heroes. */
  imageSource?: "provider_thumbnail" | null;
};

/**
 * Provider-agnostic local events fetch.
 * V1 adapter: SerpApi Google Events.
 */
export async function getLocalEvents(
  location: LocalEventLocation
): Promise<LocalEvent[]> {
  const apiKey = Deno.env.get("EVENTS_API_KEY");
  if (!apiKey) {
    console.log("[localEvents] getLocalEvents", {
      provider: "SerpApi Google Events",
      skipped: true,
      reason: "EVENTS_API_KEY not set",
      rawEventCount: 0,
      filteredCount: 0,
    });
    return [];
  }

  try {
    return await fetchLocalEventsFromSerpApi(location, apiKey);
  } catch (err) {
    console.error("[localEvents] getLocalEvents provider failure", {
      provider: "SerpApi Google Events",
      error: err instanceof Error ? err.message : String(err),
      rawEventCount: 0,
      filteredCount: 0,
    });
    return [];
  }
}

async function fetchLocalEventsFromSerpApi(
  location: LocalEventLocation,
  apiKey: string
): Promise<LocalEvent[]> {
  const cityQuery =
    location.city && location.city !== "your area" ? location.city : null;
  if (!cityQuery) {
    console.log("[localEvents] getLocalEvents", {
      provider: "SerpApi Google Events",
      skipped: true,
      reason: "no city on location",
      rawEventCount: 0,
      filteredCount: 0,
    });
    return [];
  }

  const params = new URLSearchParams({
    engine: "google_events",
    q: `Events in ${cityQuery}`,
    htichips: "date:week",
    api_key: apiKey,
  });

  const res = await fetch(`https://serpapi.com/search.json?${params}`);
  const data = await res.json();
  const rawEvents: unknown[] = Array.isArray(data.events_results)
    ? data.events_results
    : [];

  console.log("[localEvents] getLocalEvents", {
    provider: "SerpApi Google Events",
    httpStatus: res.status,
    ok: res.ok,
    rawEventCount: rawEvents.length,
    apiError: data.error ? String(data.error) : null,
  });

  if (!res.ok || data.error) {
    return [];
  }

  const mapped: LocalEvent[] = [];

  for (const raw of rawEvents) {
    if (!raw || typeof raw !== "object") continue;
    const event = raw as {
      title?: string;
      date?: { start_date?: string; when?: string };
      address?: string[];
      link?: string;
      venue?: { name?: string };
      ticket_info?: Array<{ source?: string; link?: string }>;
      thumbnail?: string;
      image?: string;
    };

    const name = event.title?.trim();
    if (!name) continue;

    const startDateTime =
      event.date?.when?.trim() ||
      event.date?.start_date?.trim() ||
      "Time TBA";

    const venue =
      event.venue?.name?.trim() ||
      (Array.isArray(event.address) && event.address[0]
        ? String(event.address[0]).trim()
        : "Venue TBA");

    const cityFromAddress =
      Array.isArray(event.address) && event.address.length > 1
        ? String(event.address[event.address.length - 1]).trim()
        : "";

    const ticket = event.ticket_info?.[0];
    const sourceUrl = ticket?.link?.trim() || event.link?.trim() || "";
    if (!sourceUrl) continue;

    const sourceName = ticket?.source?.trim() || "Google Events";
    const resolvedCity = cityFromAddress || cityQuery;

    if (!eventMatchesCity(resolvedCity, venue, name, cityQuery)) {
      console.log("[localEvents] getLocalEvents rejected foreign city", {
        expected: cityQuery,
        eventCity: resolvedCity,
        venue,
        name: name.slice(0, 60),
      });
      continue;
    }

    const imageUrl = pickProviderEventImage(event.image, event.thumbnail);

    mapped.push({
      name,
      startDateTime,
      venue,
      city: cityQuery,
      sourceUrl,
      sourceName,
      imageUrl,
      imageSource: imageUrl ? "provider_thumbnail" : null,
    });

    if (mapped.length >= 3) break;
  }

  console.log("[localEvents] getLocalEvents filtered", {
    provider: "SerpApi Google Events",
    cityQuery,
    lat: location.lat,
    lon: location.lon,
    rawEventCount: rawEvents.length,
    filteredCount: mapped.length,
    eventsWithImages: mapped.filter((e) => Boolean(e.imageUrl)).length,
  });

  return mapped;
}

/**
 * Prefer SerpAPI `image`, then `thumbnail`.
 * Drop map tiles and favicons — those are not event photography.
 */
export function pickProviderEventImage(
  image: unknown,
  thumbnail: unknown
): string | null {
  for (const candidate of [image, thumbnail]) {
    if (typeof candidate !== "string") continue;
    const url = candidate.trim();
    if (!url || !/^https?:\/\//i.test(url)) continue;
    if (/google\.com\/maps\/vt/i.test(url)) continue;
    if (/\/favicon/i.test(url) || /faviconV2/i.test(url)) continue;
    return url;
  }
  return null;
}

export function splitEventSchedule(startDateTime: string): {
  date: string;
  time: string;
} {
  const raw = startDateTime.trim();
  if (!raw || raw === "Time TBA") {
    return { date: "Date TBA", time: "Time TBA" };
  }

  const timeMatch = raw.match(
    /(\d{1,2}(?::\d{2})?(?:\s*[–-]\s*\d{1,2}(?::\d{2})?)?\s*[AaPp][Mm].*)$/
  );
  if (timeMatch) {
    const time = timeMatch[1].trim();
    const date = raw
      .slice(0, raw.length - time.length)
      .replace(/[,\s]+$/, "")
      .trim();
    return {
      date: date || "This week",
      time,
    };
  }

  return { date: raw, time: "See listing" };
}

export function buildLocalEventsBody(events: LocalEvent[]): string {
  return JSON.stringify({
    events: events.map((e) => {
      const { date, time } = splitEventSchedule(e.startDateTime);
      return {
        name: e.name,
        date,
        time,
        venue: e.venue,
        city: e.city,
        sourceUrl: e.sourceUrl,
        sourceName: e.sourceName,
        imageUrl: e.imageUrl?.trim() || null,
        imageSource: e.imageUrl ? e.imageSource ?? "provider_thumbnail" : null,
      };
    }),
  });
}
