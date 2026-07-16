/**
 * Ticketmaster Discovery API — sports, concerts, theater, comedy, family, and festivals.
 * Merges with Eventbrite and other trusted sources; never copies Ticketmaster descriptions.
 */

import {
  KINDRED_LOCAL_RADIUS_KM,
  KINDRED_LOCAL_RADIUS_MILES,
} from "../../editorial/editorialStandard.ts";
import { haversineKm } from "../../discovery/geo.ts";
import { EVENT_HORIZON_DAYS } from "../horizon.ts";
import type {
  LocalEvent,
  LocalEventCategory,
  LocalEventLocation,
  LocalEventsFetchOptions,
} from "../provider.ts";
import { inferEventCategory } from "../provider.ts";
import { buildEventBadgeSignals, resolveEventBadges } from "../badgeResolver.ts";
import { pickOfficialWebsiteFromUrls } from "../officialWebsite.ts";
import { isThirdPartyTicketUrl } from "../../editorial/officialWebsite.ts";

const TICKETMASTER_DISCOVERY_BASE =
  "https://app.ticketmaster.com/discovery/v2/events.json";

/** Segment IDs — parallel passes improve sports and genre coverage within radius. */
const TICKETMASTER_SEGMENT_PASSES: Array<{
  segmentId?: string;
  label: string;
  maxPages: number;
}> = [
  { label: "all", maxPages: 2 },
  { label: "Sports", segmentId: "KZFzniwnSyZfZ7v7nE", maxPages: 2 },
  { label: "Music", segmentId: "KZFzniwnSyZfZ7v7nJ", maxPages: 1 },
  { label: "Arts & Theatre", segmentId: "KZFzniwnSyZfZ7v7na", maxPages: 1 },
  { label: "Miscellaneous", segmentId: "KZFzniwnSyZfZ7v7n1", maxPages: 1 },
];

const TICKETMASTER_EVENT_CAP = 200;
const TICKETMASTER_PAGE_SIZE = 100;

type TicketmasterVenue = {
  name?: string;
  url?: string;
  city?: { name?: string };
  state?: { stateCode?: string };
  location?: { latitude?: string; longitude?: string };
};

type TicketmasterClassification = {
  segment?: { name?: string };
  genre?: { name?: string };
  subGenre?: { name?: string };
  type?: { name?: string };
};

type TicketmasterEvent = {
  id?: string;
  name?: string;
  url?: string;
  images?: Array<{ url?: string; width?: number }>;
  dates?: {
    start?: {
      localDate?: string;
      localTime?: string;
      dateTime?: string;
      dateTBA?: boolean;
      dateTBD?: boolean;
      timeTBA?: boolean;
      noSpecificTime?: boolean;
    };
    end?: { localDate?: string };
    timezone?: string;
    status?: { code?: string };
  };
  classifications?: TicketmasterClassification[];
  _embedded?: { venues?: TicketmasterVenue[] };
};

type TicketmasterEventsResponse = {
  _embedded?: { events?: TicketmasterEvent[] };
  page?: {
    size?: number;
    totalElements?: number;
    totalPages?: number;
    number?: number;
  };
  fault?: { faultstring?: string; detail?: { errorcode?: string } };
  errors?: Array<{ detail?: string; code?: string }>;
};

export type TicketmasterConnectionResult = {
  ok: boolean;
  message: string;
  statusCode?: number;
  totalEvents?: number;
  rateLimited?: boolean;
};

export type TicketmasterGatherDiagnostics = {
  connected: boolean;
  connectionMessage: string;
  retrieved: number;
  rateLimited?: boolean;
  apiErrors?: string[];
};

let lastTicketmasterConnection: TicketmasterConnectionResult | null = null;

export function getLastTicketmasterConnection(): TicketmasterConnectionResult | null {
  return lastTicketmasterConnection;
}

export function isTicketmasterConfigured(): boolean {
  return Boolean(Deno.env.get("TICKETMASTER_API_KEY")?.trim());
}

function ticketmasterApiKey(): string | null {
  return Deno.env.get("TICKETMASTER_API_KEY")?.trim() || null;
}

function extractTicketmasterError(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const fault = record.fault as TicketmasterEventsResponse["fault"];
  if (fault?.faultstring) {
    const code = fault.detail?.errorcode;
    return code ? `${fault.faultstring} (${code})` : fault.faultstring;
  }
  const errors = record.errors as TicketmasterEventsResponse["errors"];
  if (Array.isArray(errors) && errors.length) {
    return errors
      .map((e) => e.detail || e.code)
      .filter(Boolean)
      .join("; ");
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

export function formatTicketmasterSchedule(
  startDate: string | null | undefined,
  startTime: string | null | undefined
): {
  startDateIso: string | null;
  startDateTime: string;
  startTimeIso: string | null;
} {
  if (!startDate?.trim()) {
    return { startDateIso: null, startDateTime: "See listing", startTimeIso: null };
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
    startTimeIso: startTime?.trim() ?? null,
  };
}

export function mapTicketmasterCategory(input: {
  segment?: string | null;
  genre?: string | null;
  subGenre?: string | null;
  name: string;
  venue: string;
}): LocalEventCategory {
  const segment = input.segment?.trim().toLowerCase() ?? "";
  const genre = input.genre?.trim().toLowerCase() ?? "";
  const subGenre = input.subGenre?.trim().toLowerCase() ?? "";
  const hay = `${input.name} ${input.venue} ${genre} ${subGenre}`.toLowerCase();

  if (segment === "sports") return "sports";
  if (segment === "music") return "music";
  if (genre.includes("comedy") || subGenre.includes("comedy")) return "comedy";
  if (segment === "arts & theatre" || segment === "arts and theatre") {
    return genre.includes("comedy") ? "comedy" : "arts";
  }
  if (segment === "film") return "arts";
  if (
    genre.includes("family") ||
    subGenre.includes("family") ||
    /\b(circus|ice show|disney on ice|monster jam)\b/.test(hay)
  ) {
    return "family";
  }
  if (genre.includes("festival") || subGenre.includes("festival")) return "market";
  if (genre.includes("food") || subGenre.includes("food")) return "food";

  return inferEventCategory(input.name, input.venue);
}

function bestTicketmasterImage(images: TicketmasterEvent["images"]): string | null {
  if (!images?.length) return null;
  const sorted = [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return sorted.find((img) => img.url?.trim())?.url?.trim() ?? null;
}

function buildSearchUrl(input: {
  lat: number;
  lon: number;
  startDateTime: string;
  endDateTime: string;
  page: number;
  segmentId?: string;
}): URL {
  const apiKey = ticketmasterApiKey();
  if (!apiKey) throw new Error("TICKETMASTER_API_KEY is not configured");

  const url = new URL(TICKETMASTER_DISCOVERY_BASE);
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("latlong", `${input.lat},${input.lon}`);
  url.searchParams.set("radius", String(KINDRED_LOCAL_RADIUS_MILES));
  url.searchParams.set("unit", "miles");
  url.searchParams.set("countryCode", "US");
  url.searchParams.set("size", String(TICKETMASTER_PAGE_SIZE));
  url.searchParams.set("page", String(input.page));
  url.searchParams.set("sort", "date,asc");
  url.searchParams.set("startDateTime", input.startDateTime);
  url.searchParams.set("endDateTime", input.endDateTime);
  url.searchParams.set("includeTBA", "no");
  url.searchParams.set("includeTBD", "no");
  url.searchParams.set("source", "ticketmaster");
  if (input.segmentId) {
    url.searchParams.set("segmentId", input.segmentId);
  }
  return url;
}

function buildDateRange(now: Date): { startDateTime: string; endDateTime: string } {
  const start = new Date(now);
  const end = new Date(now);
  end.setDate(end.getDate() + EVENT_HORIZON_DAYS);
  const toTicketmasterIso = (date: Date) =>
    date.toISOString().replace(/\.\d{3}Z$/, "Z");
  return {
    startDateTime: toTicketmasterIso(start),
    endDateTime: toTicketmasterIso(end),
  };
}

async function ticketmasterRequest(
  url: URL
): Promise<{
  ok: boolean;
  status: number;
  data: TicketmasterEventsResponse | null;
  errorMessage: string | null;
  rateLimited: boolean;
}> {
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    let data: TicketmasterEventsResponse | null = null;
    try {
      data = (await res.json()) as TicketmasterEventsResponse;
    } catch {
      data = null;
    }

    if (!res.ok) {
      const detail = extractTicketmasterError(data) || res.statusText || "Request failed";
      return {
        ok: false,
        status: res.status,
        data,
        errorMessage: `${res.status} ${detail}`.trim(),
        rateLimited: res.status === 429,
      };
    }

    const apiError = extractTicketmasterError(data);
    if (apiError) {
      return {
        ok: false,
        status: res.status,
        data,
        errorMessage: apiError,
        rateLimited: /rate|quota|limit/i.test(apiError),
      };
    }

    return {
      ok: true,
      status: res.status,
      data,
      errorMessage: null,
      rateLimited: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      status: 0,
      data: null,
      errorMessage: message,
      rateLimited: false,
    };
  }
}

/** Lightweight connection check — one event within radius. */
export async function probeTicketmasterConnection(
  location?: Pick<LocalEventLocation, "lat" | "lon">
): Promise<TicketmasterConnectionResult> {
  const apiKey = ticketmasterApiKey();
  if (!apiKey) {
    return { ok: false, message: "TICKETMASTER_API_KEY is not configured" };
  }

  const lat = location?.lat ?? 33.274823;
  const lon = location?.lon ?? -111.776872;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { ok: false, message: "Invalid latitude/longitude for Ticketmaster probe" };
  }

  const range = buildDateRange(new Date());
  const url = buildSearchUrl({
    lat,
    lon,
    startDateTime: range.startDateTime,
    endDateTime: range.endDateTime,
    page: 0,
  });
  url.searchParams.set("size", "1");

  const result = await ticketmasterRequest(url);
  lastTicketmasterConnection = {
    ok: result.ok,
    message: result.ok
      ? "Ticketmaster Discovery API reachable"
      : (result.errorMessage ?? "Ticketmaster API request failed"),
    statusCode: result.status || undefined,
    totalEvents: result.ok ? (result.data?.page?.totalElements ?? 0) : undefined,
    rateLimited: result.rateLimited,
  };

  if (!result.ok) {
    return lastTicketmasterConnection;
  }

  const total = result.data?.page?.totalElements ?? 0;
  return {
    ok: true,
    message: "Ticketmaster Discovery API reachable",
    statusCode: result.status,
    totalEvents: total,
  };
}

export function parseTicketmasterEvent(
  row: TicketmasterEvent,
  fallbackCity: string
): LocalEvent | null {
  const name = row.name?.trim();
  const sourceUrl = row.url?.trim();
  if (!name || name.length < 4 || !sourceUrl || !isThirdPartyTicketUrl(sourceUrl)) {
    return null;
  }

  const start = row.dates?.start;
  if (start?.dateTBA || start?.dateTBD) return null;

  const venueRow = row._embedded?.venues?.[0];
  const venue = venueRow?.name?.trim() || "Venue TBA";
  const city =
    venueRow?.city?.name?.trim() ||
    fallbackCity ||
    "Nearby";

  const schedule = formatTicketmasterSchedule(
    start?.localDate ?? start?.dateTime?.slice(0, 10) ?? null,
    start?.noSpecificTime || start?.timeTBA ? null : start?.localTime ?? null
  );
  if (!schedule.startDateIso) return null;

  const classification = row.classifications?.[0];
  const category = mapTicketmasterCategory({
    segment: classification?.segment?.name ?? null,
    genre: classification?.genre?.name ?? null,
    subGenre: classification?.subGenre?.name ?? null,
    name,
    venue,
  });

  const lat = venueRow?.location?.latitude
    ? Number(venueRow.location.latitude)
    : null;
  const lon = venueRow?.location?.longitude
    ? Number(venueRow.location.longitude)
    : null;

  const officialWebsite = pickOfficialWebsiteFromUrls([
    venueRow?.url,
  ]);

  const badgeSignals = buildEventBadgeSignals({
    name,
    venue,
    date: schedule.startDateTime,
    time: schedule.startTimeIso ?? "See listing",
    category,
    hasTicketListing: true,
    ticketLinkType: "tickets",
    ticketProviders: ["Ticketmaster"],
    priceText: null,
    extractedPrice: null,
    parkingInfo: null,
  });
  const badges = resolveEventBadges(badgeSignals);

  return {
    name,
    startDateTime: schedule.startDateTime,
    startDateIso: schedule.startDateIso,
    endDateIso: row.dates?.end?.localDate?.trim()?.slice(0, 10) ?? null,
    startTimeIso: schedule.startTimeIso,
    eventTimezone: row.dates?.timezone?.trim() ?? null,
    venue,
    city,
    sourceUrl,
    sourceName: "Ticketmaster",
    sourceId: "ticketmaster",
    sourceTier: "aggregator",
    dateSourceType: "official_ticketing_page",
    dateSourceUrl: sourceUrl,
    ...(officialWebsite ? { officialWebsite } : {}),
    imageUrl: bestTicketmasterImage(row.images),
    imageSource: bestTicketmasterImage(row.images) ? "provider_thumbnail" : null,
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
    category,
    badges: badges.length ? badges : undefined,
    badgeSignals,
  };
}

function withinLocalRadius(
  event: LocalEvent,
  location: LocalEventLocation
): boolean {
  const lat = event.lat;
  const lon = event.lon;
  if (
    typeof lat !== "number" ||
    !Number.isFinite(lat) ||
    typeof lon !== "number" ||
    !Number.isFinite(lon)
  ) {
    return true;
  }
  return haversineKm(location.lat, location.lon, lat, lon) <= KINDRED_LOCAL_RADIUS_KM;
}

async function fetchTicketmasterPage(input: {
  location: LocalEventLocation;
  range: { startDateTime: string; endDateTime: string };
  page: number;
  segmentId?: string;
}): Promise<{
  events: TicketmasterEvent[];
  errorMessage: string | null;
  rateLimited: boolean;
}> {
  const url = buildSearchUrl({
    lat: input.location.lat,
    lon: input.location.lon,
    startDateTime: input.range.startDateTime,
    endDateTime: input.range.endDateTime,
    page: input.page,
    segmentId: input.segmentId,
  });
  const result = await ticketmasterRequest(url);
  if (!result.ok) {
    return {
      events: [],
      errorMessage: result.errorMessage,
      rateLimited: result.rateLimited,
    };
  }
  return {
    events: result.data?._embedded?.events ?? [],
    errorMessage: null,
    rateLimited: false,
  };
}

export async function fetchTicketmasterSearchCandidates(
  location: LocalEventLocation,
  options?: LocalEventsFetchOptions
): Promise<LocalEvent[]> {
  if (!isTicketmasterConfigured()) {
    console.warn("[localEvents:ticketmaster] skipped — TICKETMASTER_API_KEY not set");
    return [];
  }
  if (!Number.isFinite(location.lat) || !Number.isFinite(location.lon)) {
    console.warn("[localEvents:ticketmaster] skipped — missing coordinates");
    return [];
  }

  const connection = await probeTicketmasterConnection(location);
  if (connection.ok) {
    console.log("✅ Ticketmaster API Connected");
  } else {
    console.error(`Ticketmaster API connection failed: ${connection.message}`);
    return [];
  }

  const now = options?.now ?? new Date();
  const range = buildDateRange(now);
  const fallbackCity = location.city?.trim() || "Nearby";
  const seen = new Set<string>();
  const out: LocalEvent[] = [];
  const apiErrors: string[] = [];
  let rateLimited = false;

  for (const pass of TICKETMASTER_SEGMENT_PASSES) {
    for (let page = 0; page < pass.maxPages; page++) {
      const batch = await fetchTicketmasterPage({
        location,
        range,
        page,
        segmentId: pass.segmentId,
      });
      if (batch.errorMessage) {
        apiErrors.push(`${pass.label} page ${page}: ${batch.errorMessage}`);
        if (batch.rateLimited) rateLimited = true;
        break;
      }
      if (!batch.events.length) break;

      for (const row of batch.events) {
        const url = row.url?.trim();
        if (!url || seen.has(url)) continue;
        const parsed = parseTicketmasterEvent(row, fallbackCity);
        if (!parsed || !withinLocalRadius(parsed, location)) continue;
        seen.add(url);
        out.push(parsed);
        if (out.length >= TICKETMASTER_EVENT_CAP) break;
      }
      if (out.length >= TICKETMASTER_EVENT_CAP) break;
    }
    if (out.length >= TICKETMASTER_EVENT_CAP) break;
  }

  const sportsCount = out.filter((e) => e.category === "sports").length;

  console.log("[localEvents:ticketmaster] gathered", {
    city: location.city,
    retrieved: out.length,
    sportsCount,
    radiusMiles: KINDRED_LOCAL_RADIUS_MILES,
    horizonDays: EVENT_HORIZON_DAYS,
    rateLimited,
    apiErrors: apiErrors.length ? apiErrors : undefined,
  });

  if (apiErrors.length) {
    console.warn("[localEvents:ticketmaster] partial errors", apiErrors);
  }

  return out;
}
