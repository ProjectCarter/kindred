/**
 * Eventbrite listing discovery — parse embedded __SERVER_DATA__ from the
 * public browse page. Surfaces the same inventory readers see on Eventbrite
 * without copying its ranking or design.
 */

import type { LocalEvent, LocalEventLocation } from "../provider.ts";
import { inferEventCategory } from "../provider.ts";

const USER_AGENT =
  "Mozilla/5.0 (compatible; Kindred/1.0; +https://kindred.app)";

type EventbriteVenue = {
  name?: string;
  address?: {
    city?: string;
    region?: string;
    latitude?: string;
    longitude?: string;
    localized_address_display?: string;
  };
};

type EventbriteServerEvent = {
  name?: string;
  url?: string;
  start_date?: string;
  start_time?: string;
  image?: { url?: string };
  primary_venue?: EventbriteVenue;
};

function listingUrl(city: string, state: string, page = 1): string {
  const c = city.toLowerCase().replace(/\s+/g, "-");
  const s = state.toLowerCase();
  const base = `https://www.eventbrite.com/d/${s}--${c}/${c}-${s}/`;
  return page <= 1 ? base : `${base}?page=${page}`;
}

/** Nearby metro listing pages — Eventbrite Gilbert includes East Valley suburbs. */
function metroListingUrls(state: string): string[] {
  return ["mesa", "chandler", "tempe", "queen-creek"].map((city) =>
    listingUrl(city, state)
  );
}

function extractServerData(html: string): unknown | null {
  const marker = "window.__SERVER_DATA__ = ";
  const idx = html.indexOf(marker);
  if (idx < 0) return null;

  const start = idx + marker.length;
  let depth = 0;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function formatTime24h(time: string): string | null {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = match[2];
  if (!Number.isFinite(hour)) return null;
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${suffix}`;
}

function formatSchedule(startDate: string | null, startTime: string | null): {
  startDateIso: string | null;
  startDateTime: string;
} {
  if (!startDate?.trim()) {
    return { startDateIso: null, startDateTime: "See listing" };
  }

  const iso = startDate.trim().slice(0, 10);
  const [y, m, d] = iso.split("-").map(Number);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const dateLabel = `${months[m - 1]} ${d}, ${y}`;
  const timeLabel = startTime ? formatTime24h(startTime) : null;

  return {
    startDateIso: iso,
    startDateTime: timeLabel ? `${dateLabel} · ${timeLabel}` : dateLabel,
  };
}

function parseServerDataEvents(html: string): Array<{
  name: string;
  city: string;
  venue: string;
  startDateIso: string | null;
  startDateTime: string;
  url: string;
  imageUrl: string | null;
}> {
  const data = extractServerData(html) as {
    search_data?: { events?: { results?: EventbriteServerEvent[] } };
  } | null;

  const results = data?.search_data?.events?.results ?? [];
  const seen = new Set<string>();
  const out: Array<{
    name: string;
    city: string;
    venue: string;
    startDateIso: string | null;
    startDateTime: string;
    url: string;
    imageUrl: string | null;
  }> = [];

  for (const row of results) {
    const name = row.name?.trim();
    const url = row.url?.trim();
    if (!name || !url || name.length < 4) continue;
    if (seen.has(url)) continue;
    seen.add(url);

    const venueName = row.primary_venue?.name?.trim() ?? "";
    const city =
      row.primary_venue?.address?.city?.trim() ||
      venueName.split(",")[0]?.trim() ||
      "Gilbert";
    const venue = venueName || city;
    const schedule = formatSchedule(row.start_date ?? null, row.start_time ?? null);

    out.push({
      name,
      city,
      venue,
      startDateIso: schedule.startDateIso,
      startDateTime: schedule.startDateTime,
      url,
      imageUrl: row.image?.url?.replace(/&amp;/g, "&") ?? null,
    });
  }

  return out;
}

/** Fallback when __SERVER_DATA__ is absent — parse visible card markup. */
function parseListingCards(html: string): ReturnType<typeof parseServerDataEvents> {
  const blocks = html.split('data-event-id="').slice(1);
  const seen = new Set<string>();
  const out: ReturnType<typeof parseServerDataEvents> = [];

  for (const block of blocks) {
    const titleMatch = block.match(/aria-label="View ([^"]+)"/);
    const locMatch = block.match(/data-event-location="([^"]+)"/);
    const urlMatch = block.match(
      /href="(https:\/\/www\.eventbrite\.com\/e\/[^"?]+)/
    );
    const imageMatch = block.match(/class="event-card-image" src="([^"]+)"/);

    const name = titleMatch?.[1]?.trim();
    const url = urlMatch?.[1]?.trim();
    if (!name || !url || name.length < 4) continue;
    if (seen.has(url)) continue;
    seen.add(url);

    const location = locMatch?.[1]?.trim() ?? "";
    const city = location.split(",")[0]?.trim() || "Gilbert";
    const schedule = formatSchedule(null, null);

    out.push({
      name,
      city,
      venue: city,
      startDateIso: schedule.startDateIso,
      startDateTime: schedule.startDateTime,
      url,
      imageUrl: imageMatch?.[1]?.replace(/&amp;/g, "&") ?? null,
    });
  }

  return out;
}

async function fetchListingPage(pageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(pageUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) {
      console.warn("[localEvents:eventbriteListing] fetch failed", {
        pageUrl,
        status: res.status,
      });
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn("[localEvents:eventbriteListing] error", {
      pageUrl,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function fetchEventbriteSearchCandidates(
  location: LocalEventLocation
): Promise<LocalEvent[]> {
  const cityQuery =
    location.city && location.city !== "your area" ? location.city : null;
  const state = location.state?.trim() || "AZ";
  if (!cityQuery) return [];

  const pageUrls: string[] = [];
  for (let page = 1; page <= 4; page++) {
    pageUrls.push(listingUrl(cityQuery, state, page));
  }
  for (const metroUrl of metroListingUrls(state)) {
    pageUrls.push(metroUrl);
  }

  const seen = new Set<string>();
  const out: LocalEvent[] = [];

  for (const pageUrl of pageUrls) {
    const html = await fetchListingPage(pageUrl);
    if (!html) continue;

    const cards =
      parseServerDataEvents(html).length > 0
        ? parseServerDataEvents(html)
        : parseListingCards(html);

    for (const card of cards) {
      if (seen.has(card.url)) continue;
      seen.add(card.url);

      const category = inferEventCategory(card.name, card.venue);
      out.push({
        name: card.name,
        startDateTime: card.startDateTime,
        startDateIso: card.startDateIso,
        venue: card.venue,
        city: card.city,
        sourceUrl: card.url,
        sourceName: "Eventbrite",
        sourceId: "eventbrite",
        sourceTier: "aggregator",
        imageUrl: card.imageUrl,
        imageSource: card.imageUrl ? "provider_thumbnail" : null,
        category,
      });
    }
  }

  console.log("[localEvents:eventbriteListing] gathered", {
    cityQuery,
    pageCount: pageUrls.length,
    eventCount: out.length,
    withDates: out.filter((e) => e.startDateIso).length,
  });

  return out.slice(0, 120);
}
