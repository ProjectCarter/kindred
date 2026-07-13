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
  /** Bandit’s one-line invitation — why leave the house. */
  banditNote?: string | null;
};

/** Quiet baseline — a normal weekday still deserves a full page of events. */
const BASE_TARGET_EVENTS = 16;
/** Weekends and holidays are when people actually go out — show more. */
const BUSY_TARGET_EVENTS = 24;
/** Keep every valid raw candidate; only the target slice truncates. */
const CANDIDATE_CAP = 80;
/** One extra page only when the first page falls short of the target. */
const MAX_PAGES = 2;
const RESULTS_PER_PAGE = 20;

export type LocalEventsFetchOptions = {
  /** Widen the target on Saturdays, Sundays, and recognized holidays. */
  isBusyDay?: boolean;
};

function dedupeEvents(events: LocalEvent[]): LocalEvent[] {
  const seen = new Set<string>();
  const out: LocalEvent[] = [];
  for (const e of events) {
    const key = `${e.name.toLowerCase().trim()}__${e.venue.toLowerCase().trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

/**
 * Provider-agnostic local events fetch.
 * V1 adapter: SerpApi Google Events.
 * Prefers photograph-backed listings so the homepage grid can feel alive.
 */
export async function getLocalEvents(
  location: LocalEventLocation,
  options?: LocalEventsFetchOptions
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
    return await fetchLocalEventsFromSerpApi(location, apiKey, options);
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

async function fetchEventsPage(
  cityQuery: string,
  apiKey: string,
  start: number
): Promise<unknown[]> {
  const params = new URLSearchParams({
    engine: "google_events",
    q: `Events in ${cityQuery}`,
    htichips: "date:week",
    api_key: apiKey,
  });
  if (start > 0) params.set("start", String(start));

  const res = await fetch(`https://serpapi.com/search.json?${params}`);
  const data = await res.json();
  const rawEvents: unknown[] = Array.isArray(data.events_results)
    ? data.events_results
    : [];

  console.log("[localEvents] getLocalEvents page", {
    provider: "SerpApi Google Events",
    start,
    httpStatus: res.status,
    ok: res.ok,
    rawEventCount: rawEvents.length,
    apiError: data.error ? String(data.error) : null,
  });

  if (!res.ok || data.error) return [];
  return rawEvents;
}

function parseCandidates(
  rawEvents: unknown[],
  cityQuery: string
): LocalEvent[] {
  const candidates: LocalEvent[] = [];

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

    // Show the venue's real city (a nearby metro suburb is common and
    // fine) rather than mislabeling every result with the query city.
    const displayCity = cityFromAddress
      ? cityFromAddress.replace(/,?\s*[A-Z]{2}\s*\d{0,5}$/, "").trim() ||
        cityQuery
      : cityQuery;

    candidates.push({
      name,
      startDateTime,
      venue,
      city: displayCity,
      sourceUrl,
      sourceName,
      imageUrl,
      imageSource: imageUrl ? "provider_thumbnail" : null,
    });

    if (candidates.length >= CANDIDATE_CAP) break;
  }

  return candidates;
}

async function fetchLocalEventsFromSerpApi(
  location: LocalEventLocation,
  apiKey: string,
  options?: LocalEventsFetchOptions
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

  const targetEvents = options?.isBusyDay
    ? BUSY_TARGET_EVENTS
    : BASE_TARGET_EVENTS;

  let rawEvents = await fetchEventsPage(cityQuery, apiKey, 0);
  let candidates = dedupeEvents(parseCandidates(rawEvents, cityQuery));

  // A quiet town's first page can easily fall short of the target — only
  // pay for a second page when we actually need more material.
  let pagesFetched = 1;
  while (
    candidates.length < targetEvents &&
    rawEvents.length >= RESULTS_PER_PAGE &&
    pagesFetched < MAX_PAGES
  ) {
    const nextPage = await fetchEventsPage(
      cityQuery,
      apiKey,
      pagesFetched * RESULTS_PER_PAGE
    );
    pagesFetched += 1;
    if (!nextPage.length) break;
    rawEvents = nextPage;
    candidates = dedupeEvents([
      ...candidates,
      ...parseCandidates(nextPage, cityQuery),
    ]);
  }

  // Photo-first: the grid needs real photography whenever possible.
  const withPhoto = candidates.filter((e) => Boolean(e.imageUrl));
  const withoutPhoto = candidates.filter((e) => !e.imageUrl);
  const ranked = [...withPhoto, ...withoutPhoto].slice(0, targetEvents);

  console.log("[localEvents] getLocalEvents filtered", {
    provider: "SerpApi Google Events",
    cityQuery,
    lat: location.lat,
    lon: location.lon,
    pagesFetched,
    targetEvents,
    candidateCount: candidates.length,
    filteredCount: ranked.length,
    eventsWithImages: ranked.filter((e) => Boolean(e.imageUrl)).length,
  });

  return ranked;
}

/**
 * Prefer SerpAPI `image`, then `thumbnail`.
 * Drop map tiles, favicons, and logo/flyer-like assets — want photography.
 */
export function pickProviderEventImage(
  image: unknown,
  thumbnail: unknown
): string | null {
  for (const candidate of [image, thumbnail]) {
    if (typeof candidate !== "string") continue;
    const url = candidate.trim();
    if (!isPhotographicEventUrl(url)) continue;
    return url;
  }
  return null;
}

function isPhotographicEventUrl(url: string): boolean {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  if (/google\.com\/maps\/vt/i.test(url)) return false;
  if (/\/favicon/i.test(url) || /faviconV2/i.test(url)) return false;
  // Logos, seals, brand marks, and tiny promo tiles read as dead on a photo grid.
  if (
    /logo|wordmark|brandmark|sprite|badge|seal|emblem|avatar|icon[_-]?only/i.test(
      url
    )
  ) {
    return false;
  }
  // Extremely small Google thumbs are usually icons, not scenes.
  if (/[?&]s=1(?:&|$)/i.test(url) || /[=/]1x1/i.test(url)) return false;
  return true;
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
        banditNote: e.banditNote?.trim() || null,
      };
    }),
  });
}
