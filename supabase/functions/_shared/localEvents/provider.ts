/**
 * Local events provider adapter — kept free of the full edition builder graph
 * so lightweight Edge Functions can refresh event photography without OOM.
 */

import { eventMatchesCity } from "../contentQuality.ts";
import {
  buildEventBadgeSignals,
  extractAiHintsFromBanditNote,
  resolveEventBadges,
  type EventBadgeSignals,
  type EventInfoBadgeId,
} from "./badgeResolver.ts";
import { rankLocalEventsForEdition } from "./ranking.ts";
import { mergeEventsFromSources } from "./merge.ts";
import {
  SERPAPI_CANDIDATE_CAP,
  SERPAPI_MAX_PAGES,
} from "../editorial/publishing.ts";
import { attachEventHorizon } from "./horizon.ts";
import { buildEditorialDiscoveryStrategies } from "./searchStrategies.ts";
import { pickOfficialWebsiteFromUrls } from "./officialWebsite.ts";

export type LocalEventLocation = {
  lat: number;
  lon: number;
  city: string;
  region?: string | null;
  state?: string | null;
};

/** Coarse genre so a day's events can be shown with real variety, not just chronology. */
export type LocalEventCategory =
  | "music"
  | "comedy"
  | "arts"
  | "family"
  | "sports"
  | "food"
  | "market"
  | "nightlife"
  | "community";

export type LocalEvent = {
  name: string;
  startDateTime: string;
  /** Parsed ISO date (YYYY-MM-DD) when the provider supplies or we can infer one. */
  startDateIso?: string | null;
  /** Provider ISO end date (YYYY-MM-DD) when available. */
  endDateIso?: string | null;
  /** Provider start time (HH:mm) when available — never a publication timestamp. */
  startTimeIso?: string | null;
  /** Provider end time (HH:mm) when available. */
  endTimeIso?: string | null;
  /** IANA timezone for schedule verification — resolved from location when absent. */
  eventTimezone?: string | null;
  /** How the schedule date was sourced — drives verification priority. */
  dateSourceType?: import("./eventDateVerification.ts").EventDateSourceType;
  /** URL where the verified schedule was read. */
  dateSourceUrl?: string | null;
  /** Set when merged sources disagree on the event date. */
  dateSourceConflict?: boolean;
  /** Strict date verification metadata — required for edition publication. */
  dateVerification?: import("./eventDateVerification.ts").EventDateVerification;
  /** Editorial time bucket for the 30-day horizon — set during ranking. */
  horizonBucket?: import("./horizon.ts").EventHorizonBucket | null;
  venue: string;
  city: string;
  sourceUrl: string;
  sourceName: string;
  /** Organizer or venue official site — never a ticket aggregator listing. */
  officialWebsite?: string | null;
  /** Authentic listing photograph when the provider supplies one. */
  imageUrl?: string | null;
  /** Provenance for the photograph — never invent stock heroes. */
  imageSource?: "provider_thumbnail" | null;
  /** Whether Kindred may display listing photography from this source. */
  imageRights?: import("./sourceRights.ts").EventImageRights;
  /** Bandit's one-line invitation — why leave the house. */
  banditNote?: string | null;
  /** Verified editorial article paragraphs — composed at edition build. */
  editorialBody?: string[] | null;
  /** Keyword-inferred genre — never invented, just a plain-language guess from the title. */
  category?: LocalEventCategory;
  /** Utility badges inferred from listing signals — structured, not decorative. */
  badges?: EventInfoBadgeId[];
  /** Connector that surfaced this listing. */
  sourceId?: string;
  /** Trust tier for merge priority and ranking. */
  sourceTier?: "official" | "venue" | "aggregator";
  /** Verified venue coordinates when the provider supplies them. */
  lat?: number | null;
  lon?: number | null;
  /** Provider venue rating when available — popularity signal only. */
  venueRating?: number | null;
  venueReviewCount?: number | null;
  /** Internal editorial score breakdown — optional, not required on client. */
  editorialScore?: import("./editorialScore.ts").KindredEventEditorialScore;
  /** Server-only parse context for badge re-resolution — never serialized. */
  badgeSignals?: EventBadgeSignals;
};

/**
 * Keyword-only genre guess — zero-cost, no extra API calls or LLM spend.
 * Order matters: check the more specific genres before the community catch-all.
 */
export function inferEventCategory(
  name: string,
  venue: string
): LocalEventCategory {
  const hay = `${name} ${venue}`.toLowerCase();

  if (
    /\b(comedy|stand-?up|improv)\b/.test(hay)
  ) {
    return "comedy";
  }
  if (
    /\b(game|match|tournament|marathon|5k|10k|race|triathlon|football|basketball|baseball|softball|soccer|hockey|golf|tennis|pickleball|fitness|yoga|workout|bootcamp|mlb|nfl|nba|nhl|mls|wnba|ncaa| vs | v\. )\b/.test(
      hay
    )
  ) {
    return "sports";
  }
  if (
    /\b(concert|live music|band|dj\b|jazz|symphony|orchestra|choir|singer|album|open mic|acoustic|karaoke)\b/.test(
      hay
    )
  ) {
    return "music";
  }
  if (
    /\b(art|gallery|exhibit|museum|theater|theatre|play\b|ballet|film screening|movie screening|poetry|opera|dance recital)\b/.test(
      hay
    )
  ) {
    return "arts";
  }
  if (
    /\b(kids|children|family|storytime|petting zoo|carnival|toddler)\b/.test(
      hay
    )
  ) {
    return "family";
  }
  if (
    /\b(food|wine|beer|brewery|brewing|tasting|dinner|brunch|culinary|chef|bake sale|bbq|farmers?\s*market)\b/.test(
      hay
    )
  ) {
    return "food";
  }
  if (/\b(car show|auto show|cruise night|car meet|classic car)\b/.test(hay)) {
    return "community";
  }
  if (/\b(strongman|wrestling|mma|boxing|powerlifting)\b/.test(hay)) {
    return "sports";
  }
  if (/\b(night market|street fair|block party|food truck festival)\b/.test(hay)) {
    return "market";
  }
  if (/\b(charity|fundraiser|benefit run|walk for)\b/.test(hay)) {
    return "community";
  }
  if (
    /\b(holiday|christmas|halloween|fourth of july|memorial day|labor day|tree lighting)\b/.test(
      hay
    )
  ) {
    return "community";
  }
  if (/\b(workshop|class(es)?|seminar|lecture)\b/.test(hay)) {
    return "arts";
  }
  if (/\b(club\b|nightlife|happy hour|late night)\b/.test(hay)) {
    return "nightlife";
  }
  return "community";
}

/** Provider retrieval safety — not an editorial publication cap. */
const CANDIDATE_CAP = SERPAPI_CANDIDATE_CAP;
/** Provider pagination safety — not an editorial publication cap. */
const MAX_PAGES = SERPAPI_MAX_PAGES;
const RESULTS_PER_PAGE = 20;

export type LocalEventsFetchOptions = {
  /** Widen the target on Saturdays, Sundays, and recognized holidays. */
  isBusyDay?: boolean;
  /** Override SerpAPI date chip — pass null to omit htichips entirely. */
  htichips?: string | null;
  /** TEMPORARY — force Eventbrite-only gather + basic qualification. */
  eventbriteOnly?: boolean;
  /** Wall clock for expiration checks — defaults to `new Date()`. */
  now?: Date;
  /** Edition calendar day (YYYY-MM-DD) for recurring occurrence resolution. */
  editionDate?: string | null;
  /** IANA timezone for event schedule verification. */
  timezone?: string | null;
};

export type LocalEventsPipelineProbe = {
  provider: "SerpApi Google Events";
  apiKeyPresent: boolean;
  cityQuery: string | null;
  location: LocalEventLocation;
  dateRange: string;
  pages: Array<{
    start: number;
    httpStatus: number;
    ok: boolean;
    timedOut: boolean;
    rawEventCount: number;
    apiError: string | null;
    serpStatus: string | null;
    responseKeys: string[];
  }>;
  rawEventsTotal: number;
  parse: {
    rawTotal: number;
    rejectedNoTitle: number;
    rejectedNoSource: number;
    rejectedForeignCity: number;
    candidateCount: number;
    sampleRejections: Array<{
      reason: "no_title" | "no_source" | "foreign_city";
      title: string | null;
      venue: string | null;
      resolvedCity: string | null;
    }>;
  };
  afterDedupe: number;
  afterPhotoRank: number;
  finalCount: number;
  rawResponseSample: unknown;
};

function dedupeEvents(events: LocalEvent[]): LocalEvent[] {
  return mergeEventsFromSources([events]);
}

function targetCandidateCount(isBusyDay?: boolean): number {
  return isBusyDay ? CANDIDATE_CAP : Math.max(32, Math.round(CANDIDATE_CAP * 0.65));
}

/**
 * Provider-agnostic local events fetch — runs the multi-source editorial pipeline.
 */
export async function getLocalEvents(
  location: LocalEventLocation,
  options?: LocalEventsFetchOptions
): Promise<LocalEvent[]> {
  const { getLocalEventsFromPipeline } = await import("./pipeline.ts");
  return getLocalEventsFromPipeline(location, options);
}

/**
 * SerpAPI Google Events — raw candidates before cross-source merge and rank.
 */
export async function fetchSerpGoogleEventCandidates(
  location: LocalEventLocation,
  options?: LocalEventsFetchOptions
): Promise<LocalEvent[]> {
  const apiKey = Deno.env.get("EVENTS_API_KEY");
  if (!apiKey) {
    console.log("[localEvents] serp gather skipped", {
      reason: "EVENTS_API_KEY not set",
    });
    return [];
  }

  try {
    return await fetchLocalEventsFromSerpApi(location, apiKey, options);
  } catch (err) {
    console.error("[localEvents] serp gather failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

async function fetchEventsPageWithProbe(
  cityQuery: string,
  apiKey: string,
  start: number,
  htichips = "date:week"
): Promise<{
  rawEvents: unknown[];
  httpStatus: number;
  ok: boolean;
  timedOut: boolean;
  apiError: string | null;
  serpStatus: string | null;
  responseKeys: string[];
  rawData: unknown;
}> {
  const params = new URLSearchParams({
    engine: "google_events",
    q: `Events in ${cityQuery}`,
    api_key: apiKey,
    hl: "en",
    gl: "us",
  });
  if (htichips) params.set("htichips", htichips);
  if (start > 0) params.set("start", String(start));

  let res: Response;
  let timedOut = false;
  try {
    res = await fetch(`https://serpapi.com/search.json?${params}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    timedOut = /timeout|timed out|abort/i.test(message);
    return {
      rawEvents: [],
      httpStatus: 0,
      ok: false,
      timedOut,
      apiError: message,
      serpStatus: null,
      responseKeys: [],
      rawData: null,
    };
  }

  const data = await res.json();
  const rawEvents: unknown[] = Array.isArray(data.events_results)
    ? data.events_results
    : [];

  const apiError = data.error ? String(data.error) : null;
  const serpStatus =
    data.search_metadata?.status != null
      ? String(data.search_metadata.status)
      : null;
  const responseKeys =
    data && typeof data === "object" ? Object.keys(data as object) : [];

  console.log("[localEvents] probe page", {
    start,
    httpStatus: res.status,
    ok: res.ok,
    rawEventCount: rawEvents.length,
    apiError,
    serpStatus,
    responseKeys,
    rawResponseSample: JSON.stringify(data).slice(0, 4000),
  });

  if (!res.ok || apiError) {
    return {
      rawEvents: [],
      httpStatus: res.status,
      ok: res.ok,
      timedOut: false,
      apiError,
      serpStatus,
      responseKeys,
      rawData: data,
    };
  }

  return {
    rawEvents,
    httpStatus: res.status,
    ok: res.ok,
    timedOut: false,
    apiError: null,
    serpStatus,
    responseKeys,
    rawData: data,
  };
}

/**
 * Server-side diagnostic trace for getLocalEvents — returns stage counts and
 * a sanitized raw-response sample without exposing the API key.
 */
export async function probeLocalEventsPipeline(
  location: LocalEventLocation,
  options?: LocalEventsFetchOptions
): Promise<LocalEventsPipelineProbe> {
  const apiKey = Deno.env.get("EVENTS_API_KEY");
  const cityQuery =
    location.city && location.city !== "your area" ? location.city : null;

  const emptyProbe = (
    overrides: Partial<LocalEventsPipelineProbe> = {}
  ): LocalEventsPipelineProbe => ({
    provider: "SerpApi Google Events",
    apiKeyPresent: Boolean(apiKey),
    cityQuery,
    location,
    dateRange: "htichips=date:month",
    pages: [],
    rawEventsTotal: 0,
    parse: {
      rawTotal: 0,
      rejectedNoTitle: 0,
      rejectedNoSource: 0,
      rejectedForeignCity: 0,
      candidateCount: 0,
      sampleRejections: [],
    },
    afterDedupe: 0,
    afterPhotoRank: 0,
    finalCount: 0,
    rawResponseSample: null,
    ...overrides,
  });

  if (!apiKey) return emptyProbe();
  if (!cityQuery) return emptyProbe();

  const htichips =
    options?.htichips === undefined ? "date:week" : options.htichips;
  const dateRange = htichips ? `htichips=${htichips}` : "htichips=none";

  const pages: LocalEventsPipelineProbe["pages"] = [];
  let rawEventsTotal = 0;
  let rawResponseSample: unknown = null;

  const first = await fetchEventsPageWithProbe(cityQuery, apiKey, 0, htichips ?? undefined);
  pages.push({
    start: 0,
    httpStatus: first.httpStatus,
    ok: first.ok,
    timedOut: first.timedOut,
    rawEventCount: first.rawEvents.length,
    apiError: first.apiError,
    serpStatus: first.serpStatus,
    responseKeys: first.responseKeys,
  });
  rawEventsTotal += first.rawEvents.length;
  rawResponseSample = first.rawData;

  let parseStats = parseCandidatesWithStats(first.rawEvents, cityQuery);
  let candidates = dedupeEvents(parseStats.candidates);
  let pagesFetched = 1;
  let rawEvents = first.rawEvents;

  while (
    candidates.length < CANDIDATE_CAP &&
    rawEvents.length >= RESULTS_PER_PAGE &&
    pagesFetched < MAX_PAGES
  ) {
    const next = await fetchEventsPageWithProbe(
      cityQuery,
      apiKey,
      pagesFetched * RESULTS_PER_PAGE,
      htichips ?? undefined
    );
    pages.push({
      start: pagesFetched * RESULTS_PER_PAGE,
      httpStatus: next.httpStatus,
      ok: next.ok,
      timedOut: next.timedOut,
      rawEventCount: next.rawEvents.length,
      apiError: next.apiError,
      serpStatus: next.serpStatus,
      responseKeys: next.responseKeys,
    });
    pagesFetched += 1;
    if (!next.rawEvents.length) break;
    rawEventsTotal += next.rawEvents.length;
    rawEvents = next.rawEvents;
    const nextStats = parseCandidatesWithStats(next.rawEvents, cityQuery);
    parseStats = {
      candidates: [...parseStats.candidates, ...nextStats.candidates],
      rawTotal: parseStats.rawTotal + nextStats.rawTotal,
      rejectedNoTitle: parseStats.rejectedNoTitle + nextStats.rejectedNoTitle,
      rejectedNoSource:
        parseStats.rejectedNoSource + nextStats.rejectedNoSource,
      rejectedForeignCity:
        parseStats.rejectedForeignCity + nextStats.rejectedForeignCity,
      sampleRejections: [
        ...parseStats.sampleRejections,
        ...nextStats.sampleRejections,
      ].slice(0, 5),
    };
    candidates = dedupeEvents([
      ...candidates,
      ...nextStats.candidates,
    ]);
  }

  const afterDedupe = candidates.length;
  const ranked = rankLocalEventsForEdition(candidates.slice(0, CANDIDATE_CAP));

  const probe: LocalEventsPipelineProbe = {
    provider: "SerpApi Google Events",
    apiKeyPresent: true,
    cityQuery,
    location,
    dateRange,
    pages,
    rawEventsTotal,
    parse: {
      rawTotal: parseStats.rawTotal,
      rejectedNoTitle: parseStats.rejectedNoTitle,
      rejectedNoSource: parseStats.rejectedNoSource,
      rejectedForeignCity: parseStats.rejectedForeignCity,
      candidateCount: parseStats.candidates.length,
      sampleRejections: parseStats.sampleRejections,
    },
    afterDedupe,
    afterPhotoRank: ranked.length,
    finalCount: ranked.length,
    rawResponseSample,
  };

  console.log("[localEvents] probeLocalEventsPipeline", probe);
  return probe;
}

const SERP_RETRY_DELAY_MS = 1500;
const SERP_EMPTY_RETRIES = 2;

type EventsPageStrategy = {
  cityQuery: string;
  htichips: string | null;
  searchQuery?: string;
  strategyId?: string;
  maxPages?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeStartDateIso(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  const match = raw.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

function buildPageStrategies(
  cityQuery: string,
  location: LocalEventLocation
): EventsPageStrategy[] {
  const strategies: EventsPageStrategy[] = [
    { cityQuery, htichips: "date:month" },
    { cityQuery, htichips: "date:week" },
  ];
  const state = location.state?.trim();
  if (state && !cityQuery.toLowerCase().includes(state.toLowerCase())) {
    strategies.push({
      cityQuery: `${cityQuery}, ${state}`,
      htichips: "date:month",
    });
  }
  strategies.push({ cityQuery, htichips: null });
  return strategies;
}

async function fetchEventsPageOnce(
  strategy: EventsPageStrategy,
  apiKey: string,
  start: number
): Promise<{
  rawEvents: unknown[];
  httpStatus: number;
  ok: boolean;
  apiError: string | null;
  eventsState: string | null;
}> {
  const params = new URLSearchParams({
    engine: "google_events",
    q: strategy.searchQuery ?? `Events in ${strategy.cityQuery}`,
    api_key: apiKey,
    hl: "en",
    gl: "us",
  });
  if (strategy.htichips) params.set("htichips", strategy.htichips);
  if (start > 0) params.set("start", String(start));

  const res = await fetch(`https://serpapi.com/search.json?${params}`);
  const data = await res.json();
  const rawEvents: unknown[] = Array.isArray(data.events_results)
    ? data.events_results
    : [];
  const apiError = data.error ? String(data.error) : null;
  const eventsState =
    data.search_information?.events_results_state != null
      ? String(data.search_information.events_results_state)
      : null;

  if (!res.ok) {
    return {
      rawEvents: [],
      httpStatus: res.status,
      ok: false,
      apiError,
      eventsState,
    };
  }

  // Google can attach an `error` string even when events exist — keep them.
  if (rawEvents.length > 0) {
    return {
      rawEvents,
      httpStatus: res.status,
      ok: true,
      apiError,
      eventsState,
    };
  }

  return {
    rawEvents: [],
    httpStatus: res.status,
    ok: true,
    apiError,
    eventsState,
  };
}

function isRetriableEmptySerpResponse(
  apiError: string | null,
  eventsState: string | null
): boolean {
  if (eventsState === "Fully empty") return true;
  if (!apiError) return false;
  return /hasn't returned any results|fully empty|no results/i.test(apiError);
}

async function fetchEventsPageWithRecovery(
  cityQuery: string,
  apiKey: string,
  start: number,
  location: LocalEventLocation,
  lockedStrategy?: EventsPageStrategy
): Promise<{ rawEvents: unknown[]; strategy: EventsPageStrategy | null }> {
  const strategies = lockedStrategy
    ? [lockedStrategy]
    : buildPageStrategies(cityQuery, location);

  for (const strategy of strategies) {
    for (let attempt = 1; attempt <= SERP_EMPTY_RETRIES; attempt++) {
      const result = await fetchEventsPageOnce(strategy, apiKey, start);

      console.log("[localEvents] getLocalEvents page", {
        provider: "SerpApi Google Events",
        cityQuery: strategy.cityQuery,
        htichips: strategy.htichips,
        start,
        attempt,
        httpStatus: result.httpStatus,
        ok: result.ok,
        rawEventCount: result.rawEvents.length,
        apiError: result.apiError,
        eventsState: result.eventsState,
      });

      if (result.rawEvents.length > 0) {
        return { rawEvents: result.rawEvents, strategy };
      }

      if (
        !isRetriableEmptySerpResponse(result.apiError, result.eventsState) ||
        attempt >= SERP_EMPTY_RETRIES
      ) {
        break;
      }

      await sleep(SERP_RETRY_DELAY_MS);
    }
  }

  return { rawEvents: [], strategy: null };
}

async function fetchEventsPage(
  cityQuery: string,
  apiKey: string,
  start: number,
  location: LocalEventLocation,
  lockedStrategy?: EventsPageStrategy
): Promise<unknown[]> {
  const { rawEvents } = await fetchEventsPageWithRecovery(
    cityQuery,
    apiKey,
    start,
    location,
    lockedStrategy
  );
  return rawEvents;
}

function parseSerpTicketInfo(
  ticketInfo: Array<{ source?: string; link?: string; link_type?: string }> | undefined
): {
  hasTicketListing: boolean;
  ticketLinkType: "tickets" | "more_info" | null;
  ticketProviders: string[];
} {
  const entries = ticketInfo ?? [];
  const ticketProviders = entries
    .map((entry) => entry.source?.trim())
    .filter((source): source is string => Boolean(source));
  const ticketEntry =
    entries.find((entry) => entry.link_type === "tickets") ?? entries[0];
  const hasTicketListing = Boolean(ticketEntry?.link?.trim());
  const ticketLinkType =
    ticketEntry?.link_type === "tickets"
      ? "tickets"
      : ticketEntry?.link_type === "more_info"
        ? "more_info"
        : hasTicketListing
          ? "tickets"
          : null;

  return { hasTicketListing, ticketLinkType, ticketProviders };
}

function inferParkingFromDescription(description: string): "free" | null {
  if (
    /\b(free parking|complimentary parking|parking included|parking is free)\b/i.test(
      description
    )
  ) {
    return "free";
  }
  return null;
}

function parseSerpPrice(raw: {
  price?: string;
  extracted_price?: number;
}): { priceText: string | null; extractedPrice: number | null } {
  const priceText =
    typeof raw.price === "string" && raw.price.trim() ? raw.price.trim() : null;
  const extractedPrice =
    typeof raw.extracted_price === "number" && Number.isFinite(raw.extracted_price)
      ? raw.extracted_price
      : null;
  return { priceText, extractedPrice };
}

function parseCandidates(
  rawEvents: unknown[],
  cityQuery: string
): LocalEvent[] {
  return parseCandidatesWithStats(rawEvents, cityQuery).candidates;
}

function parseCandidatesWithStats(
  rawEvents: unknown[],
  cityQuery: string
): {
  candidates: LocalEvent[];
  rawTotal: number;
  rejectedNoTitle: number;
  rejectedNoSource: number;
  rejectedForeignCity: number;
  sampleRejections: LocalEventsPipelineProbe["parse"]["sampleRejections"];
} {
  const candidates: LocalEvent[] = [];

  let rawTotal = 0;
  let rejectedNoSource = 0;
  let rejectedForeignCity = 0;
  let rejectedNoTitle = 0;
  const sampleRejections: LocalEventsPipelineProbe["parse"]["sampleRejections"] =
    [];

  const noteRejection = (
    reason: "no_title" | "no_source" | "foreign_city",
    title: string | null,
    venue: string | null,
    resolvedCity: string | null
  ) => {
    if (sampleRejections.length >= 5) return;
    sampleRejections.push({ reason, title, venue, resolvedCity });
  };

  for (const raw of rawEvents) {
    if (!raw || typeof raw !== "object") continue;
    const event = raw as {
      title?: string;
      date?: { start_date?: string; when?: string };
      address?: string[];
      link?: string;
      description?: string;
      price?: string;
      extracted_price?: number;
      venue?: { name?: string; rating?: number; reviews?: number };
      ticket_info?: Array<{
        source?: string;
        link?: string;
        link_type?: string;
      }>;
      thumbnail?: string;
      image?: string;
    };

    const name = event.title?.trim();
    if (!name) {
      rejectedNoTitle += 1;
      noteRejection("no_title", null, null, null);
      continue;
    }
    rawTotal += 1;

    const startDateTime =
      event.date?.when?.trim() ||
      event.date?.start_date?.trim() ||
      "Time TBA";
    const startDateIso = normalizeStartDateIso(event.date?.start_date);

    const venue =
      event.venue?.name?.trim() ||
      (Array.isArray(event.address) && event.address[0]
        ? String(event.address[0]).trim()
        : "Venue TBA");

    const cityFromAddress =
      Array.isArray(event.address) && event.address.length > 1
        ? String(event.address[event.address.length - 1]).trim()
        : "";

    const ticketMeta = parseSerpTicketInfo(event.ticket_info);
    const ticket = event.ticket_info?.[0];
    const ticketLinks = (event.ticket_info ?? [])
      .map((entry) => entry.link?.trim())
      .filter((link): link is string => Boolean(link));
    const eventLink = event.link?.trim() || null;
    const officialWebsite = pickOfficialWebsiteFromUrls([...ticketLinks, eventLink]);
    const sourceUrl = ticket?.link?.trim() || eventLink || "";
    if (!sourceUrl) {
      rejectedNoSource += 1;
      noteRejection("no_source", name, venue, cityFromAddress || cityQuery);
      continue;
    }

    const sourceName = ticket?.source?.trim() || "Google Events";
    const resolvedCity = cityFromAddress || cityQuery;

    if (!eventMatchesCity(resolvedCity, venue, name, cityQuery)) {
      rejectedForeignCity += 1;
      noteRejection("foreign_city", name, venue, resolvedCity);
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

    const category = inferEventCategory(name, venue);
    const { date, time } = splitEventSchedule(startDateTime);
    const description =
      typeof event.description === "string" && event.description.trim()
        ? event.description.trim()
        : null;
    const { priceText, extractedPrice } = parseSerpPrice(event);
    const badgeSignals = buildEventBadgeSignals({
      name,
      venue,
      date,
      time,
      category,
      description,
      hasTicketListing: ticketMeta.hasTicketListing,
      ticketLinkType: ticketMeta.ticketLinkType,
      ticketProviders: ticketMeta.ticketProviders,
      priceText,
      extractedPrice,
      parkingInfo: description ? inferParkingFromDescription(description) : null,
    });
    const badges = resolveEventBadges(badgeSignals);

    candidates.push({
      name,
      startDateTime,
      startDateIso,
      dateSourceType: "trusted_secondary_listing",
      dateSourceUrl: sourceUrl,
      venue,
      city: displayCity,
      sourceUrl,
      sourceName,
      ...(officialWebsite ? { officialWebsite } : {}),
      sourceId: "serp_google_events",
      sourceTier: "aggregator",
      imageUrl,
      imageSource: imageUrl ? "provider_thumbnail" : null,
      category,
      badges: badges.length ? badges : undefined,
      badgeSignals,
      venueRating: event.venue?.rating ?? null,
      venueReviewCount: event.venue?.reviews ?? null,
    });

    if (candidates.length >= CANDIDATE_CAP) break;
  }

  console.log("[localEvents] getLocalEvents parseCandidates", {
    cityQuery,
    rawTotal,
    rejectedNoTitle,
    rejectedNoSource,
    rejectedForeignCity,
    candidateCount: candidates.length,
  });

  return {
    candidates,
    rawTotal,
    rejectedNoTitle,
    rejectedNoSource,
    rejectedForeignCity,
    sampleRejections,
  };
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

  const discoveryStrategies = buildEditorialDiscoveryStrategies(location).map(
    (strategy) => ({
      cityQuery,
      htichips: strategy.htichips,
      searchQuery: strategy.searchQuery,
      strategyId: strategy.id,
      maxPages: strategy.maxPages,
    })
  );

  const strategyResults: Array<{ id: string; count: number }> = [];
  let candidates: LocalEvent[] = [];

  // Run strategies in small batches to balance breadth vs API cost.
  const BATCH_SIZE = 4;
  for (let i = 0; i < discoveryStrategies.length; i += BATCH_SIZE) {
    const batch = discoveryStrategies.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (strategy) => {
        const firstPage = await fetchEventsPageWithRecovery(
          cityQuery,
          apiKey,
          0,
          location,
          strategy
        );
        let strategyCandidates = parseCandidates(firstPage.rawEvents, cityQuery);
        const activeStrategy = firstPage.strategy ?? strategy;
        const maxPages = strategy.maxPages ?? 1;

        let pagesFetched = 1;
        let rawEvents = firstPage.rawEvents;
        while (
          pagesFetched < maxPages &&
          rawEvents.length >= RESULTS_PER_PAGE &&
          pagesFetched < MAX_PAGES
        ) {
          const nextPage = await fetchEventsPage(
            cityQuery,
            apiKey,
            pagesFetched * RESULTS_PER_PAGE,
            location,
            activeStrategy
          );
          pagesFetched += 1;
          if (!nextPage.length) break;
          rawEvents = nextPage;
          strategyCandidates = dedupeEvents([
            ...strategyCandidates,
            ...parseCandidates(nextPage, cityQuery),
          ]);
        }

        return {
          id: strategy.strategyId ?? "unknown",
          count: strategyCandidates.length,
          candidates: strategyCandidates,
        };
      })
    );

    for (const result of batchResults) {
      strategyResults.push({ id: result.id, count: result.count });
      candidates = dedupeEvents([...candidates, ...result.candidates]);
      if (candidates.length >= CANDIDATE_CAP) break;
    }
    if (candidates.length >= CANDIDATE_CAP) break;
  }

  console.log("[localEvents] serp gather complete", {
    provider: "SerpApi Google Events",
    cityQuery,
    state: location.state ?? null,
    region: location.region ?? null,
    lat: location.lat,
    lon: location.lon,
    searchRadius: "city_query_inclusive_metro",
    strategiesRun: strategyResults.length,
    strategyCounts: strategyResults,
    candidateCap: CANDIDATE_CAP,
    candidateCount: candidates.length,
    eventsWithImages: candidates.filter((e) => Boolean(e.imageUrl)).length,
  });

  return candidates.slice(0, CANDIDATE_CAP);
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

export function buildLocalEventsBody(
  events: LocalEvent[],
  options?: { eventbriteOnly?: boolean }
): string {
  return JSON.stringify({
    ...(options?.eventbriteOnly ? { testMode: "eventbrite_only" as const } : {}),
    events: events.map((e, index) => {
      const enriched = attachEventHorizon(e);
      const { date, time } = splitEventSchedule(enriched.startDateTime);
      const category = enriched.category ?? inferEventCategory(enriched.name, enriched.venue);
      const badges =
        enriched.badges ??
        (enriched.badgeSignals
          ? resolveEventBadges({
              ...enriched.badgeSignals,
              aiHints: {
                ...enriched.badgeSignals.aiHints,
                ...(enriched.banditNote
                  ? extractAiHintsFromBanditNote(enriched.banditNote)
                  : {}),
              },
            })
          : resolveEventBadges(
              buildEventBadgeSignals({
                name: enriched.name,
                venue: enriched.venue,
                date,
                time,
                category,
                banditNote: enriched.banditNote ?? null,
              })
            ));
      const editorialScore = enriched.editorialScore ?? null;
      return {
        name: enriched.name,
        date,
        time,
        venue: enriched.venue,
        city: enriched.city,
        sourceUrl: enriched.sourceUrl,
        sourceName: enriched.sourceName,
        ...(enriched.officialWebsite?.trim()
          ? { officialWebsite: enriched.officialWebsite.trim() }
          : {}),
        ...(enriched.sourceId ? { sourceId: enriched.sourceId } : {}),
        imageUrl: enriched.imageUrl?.trim() || null,
        imageSource: enriched.imageUrl ? enriched.imageSource ?? "provider_thumbnail" : null,
        ...(enriched.imageRights ? { imageRights: enriched.imageRights } : {}),
        banditNote: enriched.banditNote?.trim() || null,
        ...(enriched.editorialBody?.length
          ? { editorialBody: enriched.editorialBody }
          : {}),
        category,
        startDateIso: enriched.startDateIso ?? null,
        horizonBucket: enriched.horizonBucket ?? null,
        editorialRank: index + 1,
        ...(editorialScore
          ? {
              editorialScore: editorialScore.total,
              editorialDimensions: editorialScore.dimensions,
              editorialReasons: editorialScore.reasons.slice(0, 6),
            }
          : {}),
        ...(badges.length ? { badges } : {}),
        ...(enriched.dateVerification
          ? { dateVerification: enriched.dateVerification }
          : {}),
      };
    }),
  });
}
