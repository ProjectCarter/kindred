// Shared edition builder for Kindred Edge Functions.
// Gathers real, checkable data, then asks Claude to write each section
// strictly from that data. Never invents a fact that wasn't retrieved.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { primaryNewsCategory } from "./stories/sources.ts";
import { buildEditionEditorialContext, buildLookingAheadGrounding } from "./editorial/index.ts";
import { LOCAL_EVENTS_EDITION_SURFACED_MAX } from "./editorial/publishing.ts";
import { loadPersonalizationProfile } from "./personalization/index.ts";
import { generateBanditPayload, loadBanditReaderProfile } from "./bandit/index.ts";
import {
  composeBanditsPickIntro,
  selectBanditsPick,
} from "./bandit/selectPick.ts";
import type { BanditsPick } from "./bandit/types.ts";
import { runLocalEditorialDecisions } from "./editor/index.ts";
import { runDiscoveryDecisions } from "./discovery/index.ts";
import type { DiscoveryPayload, DiscoveryRankingContext } from "./discovery/types.ts";
import { runKnowledgeDecisions } from "./knowledge/index.ts";
import type { KnowledgePayload, KnowledgeStoryInput } from "./knowledge/types.ts";
import {
  enrichDiscoveryKnowledge,
  enrichEditionKnowledge,
  buildTodayInHistoryGrounding,
} from "./knowledge/providers/index.ts";
import { fetchOnThisDayCandidates } from "./history/onThisDay.ts";
import { selectTodayInHistoryStory } from "./history/selectStory.ts";
import { rankOnThisDayCandidates } from "./history/scoreCandidate.ts";
import type { TodayInHistorySelection } from "./history/selectStory.ts";
import { writeTodayInHistorySection } from "./history/writeTodayInHistory.ts";
import {
  loadMemoryArchive,
  runMemoryDecisions,
} from "./memory/index.ts";
import type { MemoryPayload, MemoryStoryInput } from "./memory/types.ts";
import { runMorningEditionDecisions } from "./morningEdition/index.ts";
import type { MorningEditionPayload } from "./morningEdition/types.ts";
import { composeHeroOpening } from "./morningEdition/heroOpening.ts";
import { composeHeroWeatherTag } from "./weather/heroWeatherTag.ts";
import { fetchApprovedCityArticle } from "./storyOf/library.ts";
import { cityArticleSourceNote } from "./storyOf/sourceNote.ts";
import { buildHistoryAroundTownForEdition } from "./historyAroundTown/library.ts";
import { isMorningHeroDetailComplete } from "./heroArtwork/presentation.ts";
import type { MorningHeroExperience } from "./heroArtwork/presentation.ts";
import { listReadyHeroArtworkLibrary } from "./heroArtwork/library.ts";
import { getSeason, parseEditionDate } from "./heroArtwork/select.ts";
import {
  buildWeatherIntelligence,
  fetchWeatherForecast,
  isOpenWeatherConfigured,
  toLegacyWeatherPayload,
  weatherSourceAttribution,
} from "./weather/providers/index.ts";
import {
  getNpsParksForEdition,
  isNpsConfigured,
  topNpsPlanningNote,
} from "./nps/index.ts";
import { isTicketmasterConfigured } from "./localEvents/sources/ticketmasterSearch.ts";
import {
  formatTempC,
  formatWeatherSummary,
  resolveTemperatureUnit,
  unitInstruction,
  type TemperatureUnit,
  type TemperatureUnitPreference,
} from "./weather/units.ts";
import { runStoryEditorSafe } from "./storyEditor/index.ts";
import { localNewsSurfaceRole, promoteLocalLeadFromFrontPage } from "./storyEditor/localNewsBriefing.ts";
import { loadRecentStoryKeys } from "./stories/recentStoryKeys.ts";
import { NEWSPAPER_STYLE_RULES, stripLeadingSalutation } from "./editorialStyle.ts";
import type { LeadStory } from "./leadStory/types.ts";
import {
  buildLocalEventsBody,
  getLocalEvents,
  type LocalEvent,
} from "./localEvents/provider.ts";
import { resolveEventTimezone } from "./localEvents/eventTimezone.ts";
import { allocateLocalEventsByHorizon } from "./localEvents/horizonAllocator.ts";
import { assertEventsVerifiedForPublication } from "./localEvents/eventDateVerification.ts";
import { enrichDiscoveryImages, findDiscoveryItemById } from "./images/enrichDiscovery.ts";
import { V1_SKIP_DISCOVERY_IMAGE_ENRICHMENT } from "./editorial/v1ImagePolicy.ts";
import { pruneDiscoveryPayloadByConfidence } from "./editorial/confidencePayload.ts";
import {
  assessPersistedEditionRow,
  discoverySurfaceItemCount,
} from "./editionCompleteness.ts";
import { isUsHolidayOrEve } from "./calendar/holidays.ts";
import { getLocalPlacesForEdition } from "./places/index.ts";
import {
  auditFoodDrinkPipeline,
  logFoodDrinkPipelineAudit,
} from "./places/foodDrinkPipelineAudit.ts";
import {
  filterLocalEventsByMarket,
  filterPlacesByMarket,
  logMarketIsolationRejections,
  resolveEditionMarket,
  type ResolvedEditionMarket,
} from "./markets/editionMarket.ts";
import {
  auditEditionSectionRow,
  buildEditionDeskGapReport,
  filterEditionSectionRowsByMarket,
  logEditionDeskGapReport,
  logEditionSectionWriteAudit,
  type EditionSectionWriteRow,
} from "./markets/editionSectionAudit.ts";
import { getCatalogBootstrapState } from "./catalog/catalogBootstrap.ts";
import { catalogMetroKeyForMarket } from "../../../lib/markets/resolveEditionMarket.ts";
import { editionsConflictTarget } from "./markets/editionIdentity.ts";
import { publishMinimumViableEditionCheckpoint } from "./edition/earlyEditionPublish.ts";
import {
  logNationalDailyAttachedToCity,
  probeUsNationalDailyCache,
  resolveUsNationalDailyEditorial,
  type UsNationalDailyEditorial,
} from "./nationalDaily/resolveUsNationalDaily.ts";
import { logNationalNewsAttachedToCity } from "./nationalDaily/resolveNationalNews.ts";

export type { LocalEvent } from "./localEvents/provider.ts";
export {
  buildLocalEventsBody,
  getLocalEvents,
  pickProviderEventImage,
  splitEventSchedule,
} from "./localEvents/provider.ts";
import { enrichEventsWithBanditNotes, eventHasPublishableEditorial } from "./localEvents/banditNotes.ts";
import { persistEventEditorialBatch } from "./localEvents/eventsCatalog.ts";
export { enrichEventsWithBanditNotes };

export type BuildEditionResult =
  | { ok: true; editionId: string; metroKey: string }
  | { ok: false; error: string };

export type BuildEditionOptions = {
  /** Reader's local calendar date YYYY-MM-DD — preferred over UTC. */
  editionDate?: string | null;
  temperatureUnitPreference?: TemperatureUnitPreference | null;
  /** Structured trace for dev / market isolation audits. */
  editionTraceId?: string | null;
};

type SectionInput = {
  section_type: string;
  position: number;
  groundingData: string;
  instruction: string;
};

type Location = {
  lat: number;
  lon: number;
  city: string;
  region?: string | null;
  state?: string | null;
};

// --- Performance instrumentation -------------------------------------------
// Per-request timer (never module-level state — an Edge Function isolate can
// serve concurrent requests, so a shared array would mix up two users' timings).
// Every await-able step in buildEditionForUser is wrapped with `timer.timed`
// so real, measured durations land in the Edge Function logs on every run —
// no guessing where the 90-120s currently goes.
type TimingEntry = { label: string; ms: number };

function createTimer() {
  const entries: TimingEntry[] = [];
  const pipelineStart = performance.now();

  function record(label: string, ms: number) {
    entries.push({ label, ms });
    console.log("[buildEdition] timing", { label, ms: Math.round(ms) });
  }

  async function timed<T>(label: string, fn: () => PromiseLike<T>): Promise<T> {
    const t0 = performance.now();
    try {
      return await fn();
    } finally {
      record(label, performance.now() - t0);
    }
  }

  return {
    entries,
    timed,
    record,
    elapsedMs: () => performance.now() - pipelineStart,
  };
}

/** Sum every recorded entry whose label starts with any of the given prefixes. */
function sumByPrefix(entries: TimingEntry[], prefixes: string[]): number {
  return entries
    .filter((e) => prefixes.some((p) => e.label.startsWith(p)))
    .reduce((acc, e) => acc + e.ms, 0);
}

/** Render the "Weather .......... 1.2s" style report the audit asked for. */
function formatTimingReport(
  rows: Array<{ label: string; ms: number }>
): string {
  const labelWidth = Math.max(...rows.map((r) => r.label.length));
  return rows
    .map((r) => {
      const dotCount = Math.max(1, labelWidth + 2 - r.label.length);
      return `${r.label} ${".".repeat(dotCount)} ${(r.ms / 1000).toFixed(1)}s`;
    })
    .join("\n");
}

/**
 * No silent Phoenix / San Francisco default.
 * Client GPS, active profiles.location, travel, or home_location only.
 */
function placeFromProfileBlob(raw: unknown): Location | null {
  if (!raw || typeof raw !== "object") return null;
  const loc = raw as {
    city?: string | null;
    region?: string | null;
    state?: string | null;
    lat?: number | null;
    lon?: number | null;
  };
  if (
    loc.lat == null ||
    loc.lon == null ||
    !loc.city ||
    loc.city === "your area"
  ) {
    return null;
  }
  return {
    lat: loc.lat,
    lon: loc.lon,
    city: loc.city,
    region: loc.region ?? null,
    state: loc.state ?? null,
  };
}

/** @deprecated IP approx only — may return null. Prefer client GPS. */
export async function getApproxLocation(
  req?: Request
): Promise<Location | null> {
  if (!req) return null;

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  // Skip bogus / datacenter defaults that pin everyone to one metro.
  if (!ip || ip === "8.8.8.8") {
    return null;
  }
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`);
    const data = await res.json();
    if (data?.error || data?.latitude == null || data?.longitude == null) {
      return null;
    }
    if (!data.city || data.city === "your area") return null;
    return {
      lat: data.latitude,
      lon: data.longitude,
      city: data.city,
      region: data.region ?? data.region_code ?? null,
      state: data.region_code ?? data.region ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Prefer client GPS → profiles.location → travel → home_location.
 * Never silently defaults to a hard-coded city.
 */
export async function resolveEditionLocation(
  supabaseAdmin: SupabaseClient,
  userId: string,
  hint?: Location | null
): Promise<Location | null> {
  const hintUsable =
    hint &&
    hint.city &&
    hint.city !== "your area" &&
    Number.isFinite(hint.lat) &&
    Number.isFinite(hint.lon);

  if (hintUsable) {
    return {
      lat: hint!.lat,
      lon: hint!.lon,
      city: hint!.city,
      region: hint!.region ?? null,
      state: hint!.state ?? null,
    };
  }

  try {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("location, home_location, travel")
      .eq("id", userId)
      .maybeSingle();

    const active = placeFromProfileBlob(data?.location);
    if (active) return active;

    const travel = data?.travel as {
      away?: boolean;
      city?: string | null;
      lat?: number | null;
      lon?: number | null;
      region?: string | null;
      state?: string | null;
    } | null;
    if (travel?.away && travel.city && travel.lat != null && travel.lon != null) {
      return {
        lat: travel.lat,
        lon: travel.lon,
        city: travel.city,
        region: travel.region ?? null,
        state: travel.state ?? null,
      };
    }

    const home = placeFromProfileBlob(data?.home_location);
    if (home) return home;
  } catch {
    /* fall through */
  }

  if (
    hint &&
    Number.isFinite(hint.lat) &&
    Number.isFinite(hint.lon) &&
    hint.city &&
    hint.city !== "your area"
  ) {
    return hint;
  }

  return null;
}

/** @deprecated Prefer primaryNewsCategory from stories/sources — kept for callers. */
export function interestToNewsCategory(interests: string[]): string {
  return primaryNewsCategory(interests);
}

function parseSectionJson(text: string): { headline: string; body: string } {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Claude sometimes wraps JSON in a markdown fence despite instructions.
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1].trim());
      } catch {
        return { headline: "", body: "" };
      }
    }
    return { headline: "", body: "" };
  }
}

async function writeSection(
  input: SectionInput,
  anthropicApiKey: string
): Promise<{ headline: string; body: string }> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 300,
      system:
        "You are Kindred's editor, writing one section of a calm, honest morning edition. " +
        "You write ONLY from the grounding data given to you — never invent a fact, statistic, or event. " +
        "Tone: warm, plain, unhurried, never salesy or exclamation-heavy. " +
        "Never open with \"Good morning\" — the masthead already greets the reader. " +
        `${NEWSPAPER_STYLE_RULES} ` +
        "Respond ONLY with valid JSON: {\"headline\": string, \"body\": string}. No markdown, no preamble.",
      messages: [
        {
          role: "user",
          content: `Section type: ${input.section_type}\n\nGrounding data:\n${input.groundingData}\n\nInstruction: ${input.instruction}`,
        },
      ],
    }),
  });

  const data = await response.json();
  const text = data.content?.[0]?.text ?? "";
  const rawParsed = text
    ? parseSectionJson(text)
    : { headline: "", body: "" };
  // Same defensive strip as Morning Edition: the greeting section can be
  // shown any time of day, so a leading "Good morning" (however unlikely
  // given the prompt above) must never survive to the reader.
  const parsed = {
    headline: rawParsed.headline,
    body: stripLeadingSalutation(rawParsed.body),
  };

  console.log("[buildEdition] writeSection", {
    provider: "Anthropic",
    sectionType: input.section_type,
    httpStatus: response.status,
    ok: response.ok,
    hasContent: Boolean(text),
    parseOk: Boolean(parsed.headline && parsed.body),
    apiErrorType: data?.error?.type ?? null,
    apiErrorMessage: data?.error?.message ?? null,
  });

  return parsed;
}

async function writeEditionSection(
  section: SectionInput,
  anthropicApiKey: string,
  onThisDay: { year: number; text: string } | null
): Promise<{ headline: string; body: string }> {
  if (section.section_type === "today_in_history" && onThisDay) {
    return writeTodayInHistorySection({
      groundingData: section.groundingData,
      instruction: section.instruction,
      year: onThisDay.year,
      eventText: onThisDay.text,
      anthropicApiKey,
    });
  }
  return writeSection(section, anthropicApiKey);
}

/**
 * Load recent front-page / lead headlines so today’s paper avoids repetition.
 * Keys are titles, ids, and urls from the last several editions.
 */
// loadRecentStoryKeys — shared with staged Local News (stories/recentStoryKeys.ts)

/**
 * Load recent From the desk picks so recommendations rotate across mornings.
 */
async function loadRecentDiscoveryKeys(
  supabaseAdmin: SupabaseClient,
  userId: string,
  limit = 14
): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("editions")
    .select("edition_date, discovery")
    .eq("user_id", userId)
    .order("edition_date", { ascending: false })
    .limit(limit);

  if (error || !data?.length) {
    if (error) {
      console.log("[buildEdition] recent discovery keys lookup", {
        error: error.message,
      });
    }
    return [];
  }

  const keys: string[] = [];
  for (const row of data) {
    const discovery = row.discovery as {
      picks?: Array<{ id?: string; title?: string }>;
    } | null;
    for (const pick of discovery?.picks ?? []) {
      if (pick.id) keys.push(pick.id);
      if (pick.title) keys.push(pick.title);
    }
  }

  const unique = Array.from(new Set(keys.map((k) => k.trim()).filter(Boolean)));
  console.log("[buildEdition] recent discovery keys", {
    editionCount: data.length,
    keyCount: unique.length,
  });
  return unique;
}

export function createServiceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Edge Function secrets"
    );
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

export async function buildEditionForUser(
  supabaseAdmin: SupabaseClient,
  userId: string,
  locationHint: Location | null,
  options: BuildEditionOptions = {}
): Promise<BuildEditionResult> {
  const timer = createTimer();
  const newsApiKey = Deno.env.get("NEWS_API_KEY");
  const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");

  console.log("[buildEdition] secrets present", {
    NEWS_API_KEY: Boolean(newsApiKey),
    ANTHROPIC_API_KEY: Boolean(anthropicApiKey),
    EVENTS_API_KEY: Boolean(Deno.env.get("EVENTS_API_KEY")),
    FOURSQUARE_API_KEY: Boolean(Deno.env.get("FOURSQUARE_API_KEY")),
    OPENWEATHER_API_KEY: isOpenWeatherConfigured(),
    NPS_API_KEY: isNpsConfigured(),
    TICKETMASTER_API_KEY: isTicketmasterConfigured(),
  });

  if (!newsApiKey || !anthropicApiKey) {
    return { ok: false, error: "Missing NEWS_API_KEY or ANTHROPIC_API_KEY" };
  }

  const location = await timer.timed("Location Resolution (DB)", () =>
    resolveEditionLocation(supabaseAdmin, userId, locationHint)
  );

  if (!location) {
    console.warn("[buildEdition] no location — refusing silent city default");
    return {
      ok: false,
      error:
        "No location set. Choose a home city or enable current location in Kindred.",
    };
  }

  const editionMarket: ResolvedEditionMarket | null = resolveEditionMarket({
    city: location.city,
    state: location.state,
    region: location.region,
    lat: location.lat,
    lon: location.lon,
  });
  if (!editionMarket) {
    console.warn("[buildEdition] unsupported market — refusing edition without metro_key", {
      traceId: options.editionTraceId ?? null,
      city: location.city,
      state: location.state,
    });
    return {
      ok: false,
      error: "Unsupported market — cannot assign edition identity (metro_key).",
    };
  }

  const editionMetroKey = editionMarket.metroKey;
  const editionConflictTarget = editionsConflictTarget();

  console.log("[buildEdition] edition identity", {
    traceId: options.editionTraceId ?? null,
    userId,
    editionDate: options.editionDate ?? null,
    metroKey: editionMetroKey,
    conflictTarget: editionConflictTarget,
  });

  const catalogMetroKey = catalogMetroKeyForMarket(editionMarket);
  const marketAnchor = {
    lat: location.lat,
    lon: location.lon,
    city: location.city,
    state: location.state ?? null,
  };

  console.log("[buildEdition] resolved location", {
    traceId: options.editionTraceId ?? null,
    source: locationHint?.city ? "client-or-profile" : "profile-only",
    requestedCity: locationHint?.city ?? null,
    requestedState: locationHint?.state ?? null,
    requestedLat: locationHint?.lat ?? null,
    requestedLon: locationHint?.lon ?? null,
    city: location.city,
    region: location.region,
    state: location.state,
    lat: location.lat,
    lon: location.lon,
    resolvedMarket: editionMarket.metroKey,
    catalogMetroKey,
    marketPrimaryCity: editionMarket.primaryCity,
    marketState: editionMarket.stateCode,
  });

  // Single consolidated `profiles` read. Personalization, Memory, and the
  // Bandit reader profile each used to run their own separate `profiles`
  // query for the same row — same table, same userId, four round trips.
  // Fetching every column any of them need once, here, and threading the
  // result into all three removes three redundant DB reads per edition.
  const profileReadStart = performance.now();
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select(
      "interests, followed_topics, favorite_sources, skipped_topics, location, home_location, travel, first_name, birthday_mmdd"
    )
    .eq("id", userId)
    .maybeSingle();
  timer.record("Profile Reads - Consolidated (DB)", performance.now() - profileReadStart);

  // Eligibility still based on onboarding interests.
  const interests: string[] = profile?.interests ?? [];

  const tempPref: TemperatureUnitPreference =
    options.temperatureUnitPreference ?? "auto";
  const tempUnit: TemperatureUnit = resolveTemperatureUnit(tempPref, {
    state: location.state,
    region: location.region,
  });

  console.log("[buildEdition] temperature unit", {
    preference: tempPref,
    resolved: tempUnit,
  });

  const [recentStoryKeys, recentDiscoveryKeys, personalization, memoryArchive, banditReader] =
    await Promise.all([
      timer.timed("Recent Story Keys (DB)", () =>
        loadRecentStoryKeys(supabaseAdmin, userId, {
          metroKey: editionMetroKey,
          excludeEditionDate: options.editionDate ?? null,
        })
      ),
      timer.timed("Recent Discovery Keys (DB)", () =>
        loadRecentDiscoveryKeys(supabaseAdmin, userId)
      ),
      timer.timed("Personalization Profile (DB)", () =>
        loadPersonalizationProfile(
          supabaseAdmin,
          userId,
          {
            city: location.city,
            region: location.region,
            state: location.state,
            lat: location.lat,
            lon: location.lon,
          },
          profile
        )
      ),
      timer.timed("Memory Archive (DB)", () =>
        loadMemoryArchive(supabaseAdmin, userId, undefined, profile)
      ),
      // Moved here from its old spot after section-writing — it only needs
      // userId, so it was always independent of everything between here and
      // there. Now preloaded with `profile`, it's effectively free (no
      // extra DB round trip) and ready well before Bandit's Pick needs it.
      timer.timed("Bandit Reader Profile (DB)", () =>
        loadBanditReaderProfile(supabaseAdmin, userId, profile)
      ),
    ]);

  // Edition geography is atomic — never mix override city labels with profile coords.
  const city = location.city;
  const region = location.region ?? personalization.region ?? null;
  const state = location.state ?? personalization.state ?? null;
  const followedTopics = personalization.followedTopics;

  const weatherLat = location.lat;
  const weatherLon = location.lon;
  const eventsLocation: Location = {
    lat: weatherLat,
    lon: weatherLon,
    city: city && city !== "your area" ? city : location.city,
    region,
    state,
  };

  // Blend edition history with stories the reader actually opened/clipped.
  const blendedRecentKeys = Array.from(
    new Set([
      ...recentStoryKeys,
      ...personalization.affinities.engagedStoryKeys.slice(0, 20),
    ])
  );

  const editionDate =
    options.editionDate && /^\d{4}-\d{2}-\d{2}$/.test(options.editionDate)
      ? options.editionDate
      : new Date().toISOString().slice(0, 10);

  console.log("[buildEdition] edition date", {
    editionDate,
    source:
      options.editionDate && /^\d{4}-\d{2}-\d{2}$/.test(options.editionDate)
        ? "client-local"
        : "utc-fallback",
  });

  // Weekends and holidays deserve more local events — people actually go out.
  const editionDateObj = /^\d{4}-\d{2}-\d{2}$/.test(editionDate)
    ? new Date(
        Number(editionDate.slice(0, 4)),
        Number(editionDate.slice(5, 7)) - 1,
        Number(editionDate.slice(8, 10))
      )
    : new Date();
  const editionDayOfWeek = editionDateObj.getDay();
  const isBusyDay =
    editionDayOfWeek === 0 ||
    editionDayOfWeek === 6 ||
    isUsHolidayOrEve(editionDateObj);

  const eventTimezone = resolveEventTimezone(eventsLocation);

  const usNationalDailyCacheWarm = await timer.timed(
    "National Daily Cache Probe (DB)",
    () => probeUsNationalDailyCache(supabaseAdmin, editionDate)
  );
  console.log("[buildEdition] national daily cache", {
    editionDate,
    warm: usNationalDailyCacheWarm,
  });

  const [weatherForecast, onThisDayCandidates, localEventsRaw, localPlaces, editorial] =
    await Promise.all([
    timer.timed("Weather", () =>
      fetchWeatherForecast(weatherLat, weatherLon, supabaseAdmin)
    ),
    timer.timed("Today in History - candidates", () =>
      usNationalDailyCacheWarm
        ? Promise.resolve([])
        : fetchOnThisDayCandidates(editionDate)
    ),
    timer.timed("Local Events", () =>
      getLocalEvents(eventsLocation, {
        isBusyDay,
        now: new Date(),
        editionDate,
        timezone: eventTimezone,
        admin: supabaseAdmin,
        catalogMetroKey,
      })
    ),
    // Shared per-metro cache (see places/cache.ts) — this call almost
    // never actually hits Foursquare; it hits the cache row for this city.
    timer.timed("Food & Drink - Places", () =>
      getLocalPlacesForEdition(supabaseAdmin, eventsLocation)
    ),
    timer.timed("News - Local Editorial Decisions", () =>
      runLocalEditorialDecisions({
        editionDate,
        newsApiKey,
        ranking: {
          interests: personalization.interests.length
            ? personalization.interests
            : interests,
          followedTopics,
          city,
          region,
          state,
          metroKey: editionMetroKey,
          now: new Date(),
          maxStories: 4,
          recentStoryKeys: blendedRecentKeys,
          personalization: {
            favoriteSources: personalization.affinities.favoriteSources,
            followedTopics: personalization.affinities.followedTopics,
            skippedTopics: personalization.affinities.skippedTopics,
            engagedStoryKeys: personalization.affinities.engagedStoryKeys,
            clippedStoryKeys: personalization.affinities.clippedStoryKeys,
            confidence: personalization.affinities.confidence,
          },
        },
      })
    ),
  ]);

  let localEventsRawFiltered = localEventsRaw;
  let localPlacesFiltered = localPlaces;
  if (editionMarket) {
    const eventIsolation = filterLocalEventsByMarket(
      localEventsRaw,
      editionMarket,
      marketAnchor
    );
    localEventsRawFiltered = eventIsolation.kept;
    logMarketIsolationRejections(
      options.editionTraceId,
      "local_events",
      editionMarket,
      eventIsolation.rejected
    );

    const placeIsolation = filterPlacesByMarket(
      localPlaces,
      editionMarket,
      marketAnchor
    );
    localPlacesFiltered = placeIsolation.kept;
    logMarketIsolationRejections(
      options.editionTraceId,
      "places",
      editionMarket,
      placeIsolation.rejected
    );

    console.log("[buildEdition] market isolation gate", {
      traceId: options.editionTraceId ?? null,
      metroKey: editionMarket.metroKey,
      catalogMetroKey,
      eventsIn: localEventsRaw.length,
      eventsKept: localEventsRawFiltered.length,
      placesIn: localPlaces.length,
      placesKept: localPlacesFiltered.length,
    });
  }

  const frontPage = editorial.frontPage;
  const topStories = frontPage.stories;
  let leadStory: LeadStory | null = promoteLocalLeadFromFrontPage(editorial, {
    recentStoryKeys: blendedRecentKeys,
    place: {
      city: location.city,
      region: location.region,
      state: location.state,
      metroKey: editionMetroKey,
    },
  });

  // Computed early (was previously derived just before the real Discovery
  // Engine call) — Bandit's Pick needs it too, and every input here
  // (weather, city, tempUnit) is already resolved by this point.
  const weather = toLegacyWeatherPayload(weatherForecast);
  const weatherConditionCode =
    weather?.current?.weather_code ?? weather?.daily?.weather_code?.[0] ?? null;
  const weatherSummary = formatWeatherSummary({
    city: city ?? location.city,
    currentC: weather?.current?.temperature_2m ?? null,
    highC: weather?.daily?.temperature_2m_max?.[0] ?? null,
    lowC: weather?.daily?.temperature_2m_min?.[0] ?? null,
    unit: tempUnit,
    conditionCode: weatherConditionCode,
  });
  const weatherIntel = buildWeatherIntelligence(weatherForecast, weatherSummary);
  const weatherAttribution = weatherSourceAttribution(weatherForecast);

  let historySelection: TodayInHistorySelection | null = null;
  let npsParks: Awaited<ReturnType<typeof getNpsParksForEdition>> = [];
  try {
    const [historyResult, npsResult] = await Promise.all([
      usNationalDailyCacheWarm
        ? Promise.resolve(null)
        : timer.timed("Today in History - select", () =>
            selectTodayInHistoryStory({
              candidates: onThisDayCandidates,
              nowYear: editionDateObj.getFullYear(),
            })
          ),
      timer.timed("NPS Parks", () =>
        getNpsParksForEdition(
          supabaseAdmin,
          { lat: weatherLat, lon: weatherLon, state },
          weatherIntel
        )
      ),
    ]);
    historySelection = historyResult;
    npsParks = npsResult;
  } catch (historySelectErr) {
    console.warn("[buildEdition] today in history / NPS parallel fetch failed", historySelectErr);
  }

  let onThisDay = historySelection?.event ?? null;
  if (!onThisDay && onThisDayCandidates.length > 0) {
    const ranked = rankOnThisDayCandidates(
      onThisDayCandidates,
      editionDateObj.getFullYear()
    );
    const top = ranked[0];
    if (top) {
      onThisDay = { year: top.year, text: top.text };
      console.warn("[buildEdition] today in history fallback — no image-paired selection", {
        year: top.year,
        editorialScore: top.editorialScore,
      });
    }
  }

  const heroMonthForNational = parseEditionDate(editionDate).getMonth() + 1;
  const nationalDailyPromise = resolveUsNationalDailyEditorial(supabaseAdmin, {
    editionDate,
    editionTraceId: options.editionTraceId ?? null,
    anthropicApiKey,
    newsApiKey,
    historySelection,
    onThisDay,
    historyImage: historySelection?.image ?? null,
    heroContext: {
      date: editionDate,
      season: getSeason(heroMonthForNational),
      weatherHint:
        weatherConditionCode != null &&
        /rain|storm|drizzle/i.test(String(weatherConditionCode))
          ? "rain"
          : weather?.current?.temperature_2m != null &&
              weather.current.temperature_2m >= 32
            ? "hot"
            : weather?.current?.temperature_2m != null &&
                weather.current.temperature_2m <= 5
              ? "cold"
              : "clear",
    },
  });

  // Pipeline already returns the full ranked qualified pool — do not re-allocate.
  const localEventsRanked = localEventsRawFiltered;

  console.log("[buildEdition] local events ranked", {
    qualified: localEventsRanked.length,
    topEvent: localEventsRanked[0]?.name?.slice(0, 48) ?? null,
    topScore: localEventsRanked[0]?.editorialScore?.total ?? null,
  });

  console.log("[buildEdition] weather provider", {
    provider: weatherForecast?.provider ?? null,
    hasAlerts: Boolean(weatherIntel?.hasActiveAlerts),
    bucket: weatherIntel?.bucket ?? null,
    airQuality: Boolean(weatherForecast?.airQuality),
    planningNote: weatherIntel?.planningNote?.slice(0, 60) ?? null,
  });

  const npsParksResolved = npsParks;
  const banditPlanningNote = topNpsPlanningNote(npsParksResolved, weatherIntel);

  // Bandit's Pick candidate selection is pure CPU over the already-scored
  // news pool plus verified local places/events (raw, pre-AI-enrichment —
  // Bandit writes his own line for the pick, he doesn't need the events
  // desk's separately-enriched Bandit note) and Bandit's own seasonal
  // calendar. It only needs `editorial` + today's raw local data, not the
  // edited lead/top stories. Resolving it now (instead of after the front
  // page is fully edited) lets its Story Editor pass — only needed when
  // the winner is an article — join the SAME parallel batch below instead
  // of running afterward on its own.
  const banditDiscoveryCtx: DiscoveryRankingContext = {
    editionDate,
    now: new Date(),
    city,
    region: region ?? null,
    state: state ?? null,
    readerLat: weatherLat,
    readerLon: weatherLon,
    interests: personalization.interests.length
      ? personalization.interests
      : interests,
    followedTopics,
    favoriteSources: personalization.favoriteSources,
    weatherSummary,
    weatherIntel,
    npsParks: npsParksResolved,
    isWeekend: editorial.calendar.isWeekend,
    isSunday: editorial.calendar.isSunday,
    localPlaces: localPlacesFiltered,
    recentKeys: recentDiscoveryKeys,
  };

  const banditsPickStory = selectBanditsPick({
    scored: frontPage.scoredCandidates ?? [],
    leadId: leadStory?.id ?? null,
    frontPageIds: topStories.map((s) => s.story.id),
    interests: personalization.interests.length
      ? personalization.interests
      : interests,
    recentKeys: blendedRecentKeys,
    localEvents: localEventsRanked,
    discovery: banditDiscoveryCtx,
  });

  // Bandit's Pick just claimed one specific place/event — remove it from
  // every downstream pool so it never also turns up in Local Events,
  // Activities, Recommendations, or Bandit's Notebook. "No duplicates" is
  // a hard rule (kindred-mission.mdc), not a nice-to-have.
  const claim = banditsPickStory?.claim ?? null;
  const localEventsForBandit =
    claim?.kind === "event"
      ? localEventsRanked.filter((_e, i) => i !== claim.index)
      : localEventsRanked;
  const localPlacesForDiscovery =
    claim?.kind === "place"
      ? localPlacesFiltered.filter((p) => p.providerId !== claim.providerId)
      : localPlacesFiltered;
  const npsParksForDiscovery =
    claim?.kind === "nps"
      ? npsParks.filter((p) => p.parkCode !== claim.parkCode)
      : npsParks;

  const localEventsForEdition = allocateLocalEventsByHorizon(localEventsForBandit, {
    maxTotal: LOCAL_EVENTS_EDITION_SURFACED_MAX,
    now: editionDateObj,
    weatherIntel,
    readerCity: city ?? eventsLocation.city,
    readerLat: weatherLat,
    readerLon: weatherLon,
  });

  let localEvents: LocalEvent[] = localEventsForEdition;

  console.log("[buildEdition] local events edition surface", {
    ranked: localEventsForBandit.length,
    surfaced: localEventsForEdition.length,
  });

  async function enrichLocalEventsForEdition(): Promise<LocalEvent[]> {
    let events = localEventsForEdition;
    if (events.length === 0 || !anthropicApiKey) return events;

    const editorialTarget = Math.min(LOCAL_EVENTS_EDITION_SURFACED_MAX, 12);
    const reservePool = localEventsForBandit.filter(
      (candidate) =>
        !events.some(
          (picked) =>
            `${picked.name}|${picked.startDateTime}`.toLowerCase() ===
            `${candidate.name}|${candidate.startDateTime}`.toLowerCase()
        )
    );
    const enrichQueue = [...events, ...reservePool];
    const publishable: LocalEvent[] = [];
    const seen = new Set<string>();
    let enrichedAttempts = 0;

    while (publishable.length < editorialTarget && enrichQueue.length) {
      const batchSize = Math.min(
        4,
        editorialTarget - publishable.length + 2,
        enrichQueue.length
      );
      const batch = enrichQueue.splice(0, batchSize);
      enrichedAttempts += batch.length;
      const enriched = await timer.timed("Local Events - Bandit Notes (AI)", () =>
        enrichEventsWithBanditNotes(batch, { editionDate, maxGenerate: batch.length })
      );
      for (const event of enriched) {
        const key = `${event.name}|${event.startDateTime}`.toLowerCase();
        if (seen.has(key) || !eventHasPublishableEditorial(event)) continue;
        seen.add(key);
        publishable.push(event);
        if (publishable.length >= editorialTarget) break;
      }
    }

    events = publishable.slice(0, editorialTarget);

    console.log("[buildEdition] local events editorial gate", {
      enrichedAttempts,
      publishable: events.length,
      remainingQueue: enrichQueue.length,
    });

    void persistEventEditorialBatch(supabaseAdmin, events, catalogMetroKey).catch(
      (err) =>
        console.warn("[buildEdition] local events editorial persist failed", {
          error: err instanceof Error ? err.message : String(err),
        })
    );

    return events;
  }

  // Local Events AI enrichment and Story Editor are independent — run together.
  const [localEventsEnriched, editedBatch] = await Promise.all([
    enrichLocalEventsForEdition(),
    timer.timed(
      "AI Summaries - Story Editor (Front Page + Bandit's Pick)",
      () =>
        Promise.all([
          leadStory && anthropicApiKey
            ? runStoryEditorSafe(
                {
                  id: leadStory.id,
                  headline: leadStory.headline,
                  sourceText: leadStory.summary || leadStory.headline,
                  source: leadStory.source,
                  url: leadStory.url,
                  publishedAt: leadStory.publishedAt,
                  surfaceRole: localNewsSurfaceRole(leadStory.role, "lead"),
                  locale: "en",
                  readerPlace: {
                    city: city ?? location.city,
                    region: region ?? location.region,
                    state: state ?? location.state,
                  },
                  selectionWhy: leadStory.selection.reasons
                    .map((r) => r.label)
                    .slice(0, 4),
                },
                anthropicApiKey
              )
            : Promise.resolve(null),
          banditsPickStory?.kind === "article" && anthropicApiKey
            ? runStoryEditorSafe(
                {
                  id: banditsPickStory.id,
                  headline: banditsPickStory.headline,
                  sourceText:
                    banditsPickStory.summary || banditsPickStory.headline,
                  source: banditsPickStory.source,
                  url: banditsPickStory.url,
                  publishedAt: banditsPickStory.publishedAt,
                  surfaceRole: "bandits_pick",
                  locale: "en",
                  selectionWhy: [banditsPickStory.why].filter(Boolean),
                },
                anthropicApiKey
              )
            : Promise.resolve(null),
          ...topStories.map((ranked) =>
            runStoryEditorSafe(
              {
                id: ranked.story.id,
                headline: ranked.story.title,
                sourceText: ranked.story.description || ranked.story.title,
                source: ranked.story.source,
                url: ranked.story.url,
                publishedAt: ranked.story.publishedAt,
                surfaceRole: localNewsSurfaceRole(ranked.role, "top_story"),
                locale: "en",
                readerPlace: {
                  city: city ?? location.city,
                  region: region ?? location.region,
                  state: state ?? location.state,
                },
                selectionWhy: ranked.reasons.map((r) => r.label).slice(0, 3),
              },
              anthropicApiKey
            )
          ),
        ])
    ),
  ]);

  localEvents = localEventsEnriched;

  const [editedLead, editedPick, ...editedTopStories] = editedBatch;

  if (leadStory && editedLead) {
    const cardSummary =
      editedLead.dek?.trim() ||
      editedLead.paragraphs[0]?.trim().slice(0, 220) ||
      leadStory.summary;
    leadStory = {
      ...leadStory,
      headline: editedLead.headline || leadStory.headline,
      summary: cardSummary,
      body: editedLead.paragraphs,
      dek: editedLead.dek ?? cardSummary,
      desk: editedLead.desk as unknown as Record<string, unknown>,
    };
    console.log("[buildEdition] storyEditor lead", {
      path: editedLead.desk.path,
      passes: editedLead.desk.passes,
      paras: editedLead.paragraphs.length,
      scores: editedLead.desk.scores,
    });
  }

  // Story Editor — each Top Story alone (never a multi-wire mashup article).
  const frontPageStoriesForDesk: Array<{
    id: string;
    title: string;
    description: string;
    dek: string | null;
    body: string[];
    url: string | null;
    imageUrl: string | null;
    role: string;
    score: number;
    reasons: typeof topStories[number]["reasons"];
    source: string;
    category: string | null;
    publishedAt: string | null;
  }> = topStories.map((ranked, i) => {
    const edited = editedTopStories[i];
    console.log("[buildEdition] storyEditor top_story", {
      id: ranked.story.id.slice(0, 40),
      path: edited.desk.path,
      passes: edited.desk.passes,
      paras: edited.paragraphs.length,
    });
    const wireSummary =
      ranked.story.description?.trim() || ranked.story.title.trim();
    return {
      id: ranked.story.id,
      title: edited.headline || ranked.story.title,
      description: edited.bodyText || wireSummary,
      dek: edited.dek,
      body: edited.paragraphs,
      url: ranked.story.url,
      imageUrl: ranked.story.imageUrl ?? null,
      role: ranked.role,
      score: ranked.score,
      reasons: ranked.reasons,
      source: ranked.story.source,
      category: ranked.story.category,
      publishedAt: ranked.story.publishedAt,
    };
  });

  const discovery: DiscoveryPayload = runDiscoveryDecisions({
    editionDate,
    now: new Date(),
    city,
    region,
    state,
    readerLat: weatherLat,
    readerLon: weatherLon,
    interests: personalization.interests.length
      ? personalization.interests
      : interests,
    followedTopics,
    favoriteSources: personalization.favoriteSources,
    weatherSummary,
    weatherIntel,
    npsParks: npsParksForDiscovery,
    isWeekend: editorial.calendar.isWeekend,
    isSunday: editorial.calendar.isSunday,
    localEvents: localEventsForBandit,
    localPlaces: localPlacesForDiscovery,
    recentKeys: recentDiscoveryKeys,
  });

  let discoveryForBuild: DiscoveryPayload =
    discoverySurfaceItemCount(discovery) === 0
      ? runDiscoveryDecisions({
          editionDate,
          now: new Date(),
          city,
          region,
          state,
          readerLat: weatherLat,
          readerLon: weatherLon,
          interests: personalization.interests.length
            ? personalization.interests
            : interests,
          followedTopics,
          favoriteSources: personalization.favoriteSources,
          weatherSummary,
          weatherIntel,
          npsParks: npsParksForDiscovery,
          isWeekend: editorial.calendar.isWeekend,
          isSunday: editorial.calendar.isSunday,
          localEvents: localEventsForBandit,
          localPlaces: localPlacesForDiscovery,
          recentKeys: [],
        })
      : discovery;

  if (discoverySurfaceItemCount(discoveryForBuild) === 0) {
    console.warn("[buildEdition] discovery still empty after recentKeys retry", {
      candidateCount: discoveryForBuild.selectionMeta.candidateCount,
    });
  }

  try {
    logFoodDrinkPipelineAudit(
      auditFoodDrinkPipeline({
        localPlaces: localPlacesFiltered,
        discovery: discoveryForBuild,
        readerLat: weatherLat,
        readerLon: weatherLon,
      }),
      city ?? location.city
    );
  } catch (auditErr) {
    console.warn("[buildEdition] food drink pipeline audit failed", auditErr);
  }

  let discoveryWithImages: DiscoveryPayload = discoveryForBuild;
  if (V1_SKIP_DISCOVERY_IMAGE_ENRICHMENT) {
    console.log("[buildEdition] V1 — skipping discovery image enrichment");
  } else {
    try {
      discoveryWithImages = await enrichDiscoveryImages(supabaseAdmin, discovery, {
        banditPickItemId: banditsPickStory?.discoveryItem?.id ?? null,
        seedIfSparse: false,
      });
      if (banditsPickStory?.discoveryItem?.id) {
        const enrichedItem = findDiscoveryItemById(
          discoveryWithImages,
          banditsPickStory.discoveryItem.id
        );
        if (enrichedItem?.editorialImage) {
          banditsPickStory.discoveryItem.editorialImage =
            enrichedItem.editorialImage;
        }
      }
      console.log("[buildEdition] discovery images enriched");
    } catch (imageErr) {
      console.warn("[buildEdition] discovery image enrichment failed", imageErr);
    }
  }

  try {
    discoveryWithImages = await enrichDiscoveryKnowledge(supabaseAdmin, discoveryWithImages, {
      city,
      region,
      state,
    });
    console.log("[buildEdition] discovery knowledge grounding enriched");
  } catch (knowledgeErr) {
    console.warn("[buildEdition] discovery knowledge enrichment failed", knowledgeErr);
  }

  try {
    const discoveryBeforePrune = discoveryWithImages;
    discoveryWithImages = pruneDiscoveryPayloadByConfidence(discoveryWithImages);
    if (
      discoverySurfaceItemCount(discoveryWithImages) === 0 &&
      discoverySurfaceItemCount(discoveryBeforePrune) > 0
    ) {
      console.warn(
        "[buildEdition] confidence prune removed all discovery surfaces — keeping pre-prune payload"
      );
      discoveryWithImages = discoveryBeforePrune;
    }
    console.log("[buildEdition] discovery editorial confidence prune complete", {
      pickCount: discoveryWithImages.picks.length,
      surfaceItems: discoverySurfaceItemCount(discoveryWithImages),
      enrichQueue: discoveryWithImages.selectionMeta.enrichQueue?.length ?? 0,
    });
  } catch (confidenceErr) {
    console.warn("[buildEdition] discovery confidence prune failed", confidenceErr);
  }

  const knowledgeStories: KnowledgeStoryInput[] = [];
  if (leadStory) {
    knowledgeStories.push({
      storyKey: leadStory.id,
      section: "lead",
      headline: leadStory.headline,
      summary: leadStory.summary,
      source: leadStory.source,
      url: leadStory.url,
      role: leadStory.role,
      publishedAt: leadStory.publishedAt,
      reasons: leadStory.selection.reasons,
    });
  }
  for (const story of frontPageStoriesForDesk) {
    knowledgeStories.push({
      storyKey: story.id,
      section: "top_stories",
      headline: story.title,
      summary: story.description ?? "",
      source: story.source,
      url: story.url,
      role: story.role,
      category: story.category,
      publishedAt: story.publishedAt,
      reasons: story.reasons,
    });
  }

  const knowledge: KnowledgePayload = runKnowledgeDecisions({
    editionDate,
    now: new Date(),
    location: {
      city,
      region: region ?? null,
      state: state ?? null,
      lat: weatherLat,
      lon: weatherLon,
    },
    stories: knowledgeStories,
    onThisDay,
    localEvents: localEvents.map((e) => ({
      name: e.name,
      venue: e.venue,
      city: e.city,
      startDateTime: e.startDateTime,
    })),
    recentStoryKeys: blendedRecentKeys,
    interests: personalization.interests.length
      ? personalization.interests
      : interests,
    followedTopics,
    discoveryPicks: discovery.picks.map((p) => ({
      id: p.id,
      title: p.title,
      category: p.category,
      why: p.why,
    })),
    maxFacetsPerStory: 6,
  });

  let knowledgeWithGrounding: KnowledgePayload = knowledge;
  try {
    knowledgeWithGrounding = await enrichEditionKnowledge(supabaseAdmin, {
      knowledge,
      onThisDay,
      location: { city, region, state },
    });
    if (historySelection && knowledgeWithGrounding.providerGrounding) {
      knowledgeWithGrounding.providerGrounding.onThisDayImage =
        historySelection.image;
      knowledgeWithGrounding.providerGrounding.onThisDaySelection = {
        editorialScore: historySelection.editorialScore,
        imageScore: historySelection.imageScore,
        candidateCount: historySelection.candidateCount,
        selectedRank: historySelection.selectedRank,
        editorNotes: historySelection.editorNotes,
      };
      knowledgeWithGrounding.selectionMeta.editorNotes.push(
        ...historySelection.editorNotes
      );
    }
    console.log("[buildEdition] knowledge provider grounding enriched", {
      onThisDay: Boolean(knowledgeWithGrounding.providerGrounding?.onThisDay),
      onThisDayImage: Boolean(
        knowledgeWithGrounding.providerGrounding?.onThisDayImage?.url
      ),
      historyCandidateCount: onThisDayCandidates.length,
    });
  } catch (knowledgeErr) {
    console.warn("[buildEdition] knowledge provider enrichment failed", knowledgeErr);
  }

  const memoryStories: MemoryStoryInput[] = knowledgeStories.map((s) => ({
    storyKey: s.storyKey,
    section: s.section,
    headline: s.headline,
    summary: s.summary,
    role: s.role,
    category: s.category,
  }));

  const memory: MemoryPayload = runMemoryDecisions({
    editionDate,
    now: new Date(),
    location: {
      city,
      region: region ?? null,
      state: state ?? null,
    },
    homeLocation: memoryArchive.homeLocation,
    travel: memoryArchive.travel,
    interests: personalization.interests.length
      ? personalization.interests
      : interests,
    followedTopics,
    favoriteSources: personalization.favoriteSources,
    skippedTopics: personalization.skippedTopics,
    confidence: personalization.affinities.confidence,
    engagedStoryKeys: personalization.affinities.engagedStoryKeys,
    clippedStoryKeys: personalization.affinities.clippedStoryKeys,
    todayStories: memoryStories,
    priorEditions: memoryArchive.priorEditions,
    unfinishedReads: memoryArchive.unfinishedReads,
    clippings: memoryArchive.clippings.length
      ? memoryArchive.clippings
      : undefined,
    localEvents: localEvents.map((e) => ({
      name: e.name,
      venue: e.venue,
      city: e.city,
      startDateTime: e.startDateTime,
    })),
    lastReadAt: memoryArchive.lastReadAt,
    openDays: memoryArchive.openDays,
    maxThreads: 14,
  });

  console.log("[buildEdition] lead story", {
    selected: Boolean(leadStory),
    role: leadStory?.role ?? null,
    strategy: leadStory?.selection.strategy ?? null,
    headline: leadStory?.headline?.slice(0, 80) ?? null,
    hasHeroImage: Boolean(leadStory?.heroImage.uri),
    editionMode: editorial.policy.mode,
    discoverySurfaces: Object.keys(discovery.surfaces),
    knowledgeStories: knowledgeWithGrounding.selectionMeta.storyCount,
    knowledgeFacets: knowledgeWithGrounding.selectionMeta.facetCount,
    memoryThreads: memory.selectionMeta.threadCount,
    continuityDays: memory.reader.continuityDays,
  });

  const sections: SectionInput[] = [];

  sections.push({
    section_type: "greeting",
    position: 0,
    groundingData: `Today's date: ${new Date().toDateString()}. City: ${location.city}. Edition mode: ${editorial.calendar.modeLabel}.`,
    instruction:
      "Write a short welcoming message for the morning edition (one or two calm sentences). Do not start with Good morning. Do not restate the full calendar date. No exclamation points.",
  });

  // Deliberately NOT an AI section — see heroWeatherTag.ts. The AI weather
  // sentence kept naming the city inside its own sentence even though the
  // client already prefixes the city label, producing double-city lines
  // like "Gilbert · Gilbert sits at 103°F...". A short deterministic tag
  // (5-8 words, never mentions the city) is appended directly to `rows`
  // below, the same way `local_events` skips the AI pass entirely.
  const heroWeatherTag = weather?.current
    ? composeHeroWeatherTag({
        editionDate,
        userId,
        highC: weather.daily?.temperature_2m_max?.[0] ?? null,
        currentC: weather.current.temperature_2m ?? null,
        conditionCode: weatherConditionCode,
        unit: tempUnit,
      })
    : null;

  if (topStories.length > 0) {
    sections.push({
      section_type: "top_stories",
      position: 2,
      groundingData:
        `City: ${city ?? location.city}. Edition mode: ${editorial.calendar.modeLabel}.\n` +
        `Front-page slate (titles only — each story opens separately in the reader):\n` +
        frontPageStoriesForDesk
          .map((s, i) => `${i + 1}. ${s.title} (${s.source})`)
          .join("\n"),
      instruction:
        "Write ONLY a short Top Stories standfirst for the folio — one calm headline and " +
        "two or three sentences introducing today’s curated slate. " +
        "Do NOT summarize each story in full. Do NOT combine unrelated stories into one narrative. " +
        "Each story will open as its own article. Plain, unhurried, no exclamation points.",
    });

    console.log("[buildEdition] top stories selection meta", {
      selectedCount: frontPageStoriesForDesk.length,
      roles: frontPageStoriesForDesk.map((s) => s.role),
      composition: frontPage.selectionMeta.composition ?? null,
      editionMode: editorial.policy.mode,
      decisionNotes: editorial.decisions.editorNotes,
      reasonCodes: frontPageStoriesForDesk.map((s) =>
        s.reasons.map((r) => r.code)
      ),
    });
  }

  // local_events is stored as structured JSON for card UI — not rewritten by Claude.
  // Today in History copy comes from the shared U.S. national daily layer — not per-city AI.

  if (weather?.daily) {
    const tomorrowHigh = formatTempC(
      weather.daily.temperature_2m_max?.[1],
      tempUnit
    );
    const tomorrowLow = formatTempC(
      weather.daily.temperature_2m_min?.[1],
      tempUnit
    );
    const lookingAheadGrounding = buildLookingAheadGrounding({
      editionDate,
      now: new Date(),
      city,
      tempUnit,
      tomorrowHighLabel: tomorrowHigh,
      tomorrowLowLabel: tomorrowLow,
      todayHighC: weather.daily.temperature_2m_max?.[0] ?? null,
      tomorrowHighC: weather.daily.temperature_2m_max?.[1] ?? null,
      localEvents,
    });
    sections.push({
      section_type: "looking_ahead",
      position: 6,
      groundingData: lookingAheadGrounding,
      instruction:
        `Write a brief, practical Looking Ahead note that closes today’s paper with a glance at tomorrow. ` +
        `Ground ONLY in the numbered facts below. Lead with the most useful fact for the reader ` +
        `(holiday or a named local event before routine forecast). Two to four short sentences. ` +
        `Calm newspaper tone — specific, not promotional. Not generic encouragement. Do not invent facts. ` +
        `${unitInstruction(tempUnit)} Do not mix temperature units.`,
    });
  }

  const plannedTypes = [
    ...sections.map((s) => s.section_type),
    ...(localEvents.length > 0 ? ["local_events"] : []),
  ];

  console.log("[buildEdition] section construction", {
    plannedCount: plannedTypes.length,
    plannedTypes,
    weatherPresent: Boolean(weather?.current),
    topStoriesCount: topStories.length,
    localEventsCount: localEvents.length,
    onThisDayPresent: Boolean(onThisDay),
  });

  // Section Writing and Bandit Payload are independent of each other (Bandit
  // Payload only needs editorialContext + banditsPick, both already
  // resolvable from data the Story Editor batch already returned — neither
  // needs the *written* section copy below). They used to run one after the
  // other for no reason; running them together shaves a few real seconds off
  // every build with zero change to what either one produces.
  const editorialContext = buildEditionEditorialContext({
    editionDate,
    location: {
      city,
      region,
      state,
    },
    interests: personalization.interests.length
      ? personalization.interests
      : interests,
    followedTopics,
    favoriteSources: personalization.favoriteSources,
    skippedTopics: personalization.skippedTopics,
    personalizationConfidence: personalization.affinities.confidence,
    weather: weather?.current
      ? {
          currentTempC: weather.current.temperature_2m,
          todayHighC: weather.daily?.temperature_2m_max?.[0] ?? null,
          todayLowC: weather.daily?.temperature_2m_min?.[0] ?? null,
          tomorrowHighC: weather.daily?.temperature_2m_max?.[1] ?? null,
          tomorrowLowC: weather.daily?.temperature_2m_min?.[1] ?? null,
        }
      : null,
    frontPage: {
      stories: frontPageStoriesForDesk,
      composition: frontPage.selectionMeta.composition ?? null,
      editorialDecisions: editorial.decisions,
    },
    localEvents,
    onThisDay,
    discovery: {
      picks: discoveryForBuild.picks,
      surfaces: Object.keys(discoveryForBuild.surfaces),
      editorNotes: discoveryForBuild.selectionMeta.editorNotes,
    },
    knowledge: {
      storyCount: knowledgeWithGrounding.selectionMeta.storyCount,
      facetCount: knowledgeWithGrounding.selectionMeta.facetCount,
      highlights: knowledgeWithGrounding.highlights,
      editorNotes: knowledgeWithGrounding.selectionMeta.editorNotes,
    },
    memory: {
      threadCount: memory.selectionMeta.threadCount,
      continuityDays: memory.reader.continuityDays,
      sinceYouLastRead: memory.sinceYouLastRead,
      highlights: memory.highlights,
      editorNotes: memory.selectionMeta.editorNotes,
    },
    now: new Date(),
  });

  console.log("[buildEdition] editorial context", {
    sectionTypes: editorialContext.sections.map((s) => s.sectionType),
    signals: editorialContext.signals,
    noteCount: editorialContext.sections.reduce(
      (n, s) => n + s.notes.length + (s.items?.reduce((m, i) => m + i.notes.length, 0) ?? 0),
      0
    ),
  });

  // banditReader was preloaded earlier (in the initial DB batch) and
  // banditsPickStory / editedPick were already resolved above, inside the
  // same parallel batch as the front-page Story Editor calls — see the
  // "Bandit's Pick candidate selection" comment near the top of this
  // function for why that merge is safe. editedPick only exists when the
  // winner is an article (see the Story Editor batch above) — every other
  // kind already carries Kindred-voiced copy from its own desk.
  let banditsPick: BanditsPick | null = null;
  if (banditsPickStory) {
    const isArticle = banditsPickStory.kind === "article";
    const headline =
      (isArticle && editedPick?.headline) || banditsPickStory.headline;
    const summary =
      (isArticle && editedPick?.bodyText) || banditsPickStory.summary;

    banditsPick = {
      kind: banditsPickStory.kind,
      intro: composeBanditsPickIntro(
        { ...banditsPickStory, headline, summary },
        editionDate
      ),
      story: {
        id: banditsPickStory.id,
        headline,
        summary,
        body: banditsPickStory.body?.length ? banditsPickStory.body : undefined,
        modules: banditsPickStory.modules?.length
          ? banditsPickStory.modules
          : undefined,
        closingNote: banditsPickStory.closingNote?.trim() || undefined,
        mapsQuery: banditsPickStory.mapsQuery?.trim() || undefined,
        actionLabel: banditsPickStory.actionLabel?.trim() || undefined,
        nearby: banditsPickStory.nearby?.length ? banditsPickStory.nearby : undefined,
        heroMomentId: banditsPickStory.heroMomentId ?? undefined,
        imageCaption: banditsPickStory.imageCaption ?? undefined,
        source: banditsPickStory.source,
        url: banditsPickStory.url,
        publishedAt: banditsPickStory.publishedAt,
        imageUrl: banditsPickStory.imageUrl,
        category: banditsPickStory.category,
        why: banditsPickStory.why,
        discoveryItem: banditsPickStory.discoveryItem,
      },
    };
    if (isArticle && editedPick) {
      console.log("[buildEdition] storyEditor bandits_pick", {
        path: editedPick.desk.path,
        passes: editedPick.desk.passes,
        paras: editedPick.paragraphs.length,
      });
    }
  }

  console.log("[buildEdition] bandits pick", {
    selected: Boolean(banditsPick),
    kind: banditsPick?.kind ?? null,
    headline: banditsPick?.story.headline?.slice(0, 60) ?? null,
  });

  let usNationalDaily: UsNationalDailyEditorial | null = null;
  try {
    usNationalDaily = await timer.timed("National Daily Editorial", () =>
      nationalDailyPromise
    );
    if (usNationalDaily?.id) {
      logNationalDailyAttachedToCity({
        traceId: options.editionTraceId ?? null,
        editionDate,
        nationalDailyId: usNationalDaily.id,
        metroKey: editionMetroKey,
        masterpieceArtworkId: usNationalDaily.todayMasterpiece?.artworkId ?? null,
      });
    }
    if (usNationalDaily?.nationalNews && usNationalDaily.id) {
      logNationalNewsAttachedToCity({
        traceId: options.editionTraceId ?? null,
        editionDate,
        nationalDailyId: usNationalDaily.id,
        packageId: usNationalDaily.nationalNews.packageId,
        metroKey: editionMetroKey,
        storyCount: usNationalDaily.nationalNews.stories.length,
      });
    }
  } catch (nationalErr) {
    console.warn("[buildEdition] national daily editorial skipped", nationalErr);
  }

  if (
    usNationalDaily?.todayInHistory?.image &&
    knowledgeWithGrounding.providerGrounding
  ) {
    knowledgeWithGrounding.providerGrounding.onThisDayImage =
      usNationalDaily.todayInHistory.image;
    if (historySelection) {
      knowledgeWithGrounding.providerGrounding.onThisDaySelection = {
        editorialScore: historySelection.editorialScore,
        imageScore: historySelection.imageScore,
        candidateCount: historySelection.candidateCount,
        selectedRank: historySelection.selectedRank,
        editorNotes: historySelection.editorNotes,
      };
    }
  }

  const [written, bandit] = await Promise.all([
    timer.timed("AI Summaries - Section Writing", () =>
      Promise.all(
        sections.map((section) =>
          writeEditionSection(section, anthropicApiKey, onThisDay)
        )
      )
    ),
    timer.timed("Bandit Payload", () =>
      generateBanditPayload(
        {
          editionDate,
          now: new Date(),
          userId,
          reader: banditReader,
          location: { city, region, state },
          weatherSummary,
          weather: { currentTempC: weather?.current?.temperature_2m ?? null },
          planningNote: banditPlanningNote,
          signals: {
            hasBreakingNews: editorialContext.signals.hasBreakingNews,
            hasLocalEvents: editorialContext.signals.hasLocalEvents,
            weatherChange: editorialContext.signals.weatherChange,
            holidayTomorrow: editorialContext.signals.holidayTomorrow,
            primaryInterests: editorialContext.signals.primaryInterests,
          },
          editorBrief: editorialContext.editorBrief,
          personalization: {
            favoriteSources: personalization.favoriteSources,
            confidence: personalization.affinities.confidence,
          },
          discoveryBrief: discovery.editorBrief,
          discoveryPicks: discovery.picks.map((p) => ({
            title: p.title,
            category: p.category,
            why: p.why,
          })),
          pick: banditsPick,
        },
        anthropicApiKey
      )
    ),
  ]);

  const writtenUsable = written.filter((w) => w.headline && w.body).length;
  console.log("[buildEdition] write results", {
    plannedCount: sections.length,
    usableWrittenCount: writtenUsable,
    emptyWrittenCount: sections.length - writtenUsable,
    localEventsStructured: localEvents.length > 0,
  });

  // MVP checkpoint — core desks first so the client can paint before optional AI polish.
  try {
    const mvpCheckpointStart = performance.now();
    const cityArticleEarly = await fetchApprovedCityArticle(supabaseAdmin, {
      city,
      state,
      region,
      lat: weatherLat,
      lon: weatherLon,
    });

    const mvpRows: Array<{
      section_type: string;
      position: number;
      headline: string;
      body: string;
      source_note?: string | null;
    }> = [];

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i]!;
      const copy = written[i];
      if (!copy?.headline || !copy?.body) continue;
      if (section.section_type !== "weather") {
        continue;
      }
      mvpRows.push({
        section_type: section.section_type,
        position: section.position,
        headline: copy.headline,
        body: copy.body,
        source_note: weatherAttribution,
      });
    }

    if (usNationalDaily?.todayInHistory) {
      mvpRows.push({
        section_type: "today_in_history",
        position: 4,
        headline: usNationalDaily.todayInHistory.headline,
        body: usNationalDaily.todayInHistory.body,
        source_note: usNationalDaily.todayInHistory.sourceNote,
      });
    }

    if (cityArticleEarly) {
      mvpRows.push({
        section_type: "story_of",
        position: 5,
        headline: cityArticleEarly.headline,
        body: cityArticleEarly.body,
        source_note: cityArticleSourceNote(cityArticleEarly),
      });
    }

    if (heroWeatherTag) {
      mvpRows.push({
        section_type: "weather",
        position: 1,
        headline: heroWeatherTag,
        body: heroWeatherTag,
        source_note: weatherAttribution,
      });
    }

    if (localEvents.length > 0) {
      const publishableEvents = assertEventsVerifiedForPublication(localEvents, {
        now: new Date(),
        location: eventsLocation,
        eventTimezone,
        editionDate,
      });
      if (publishableEvents.length > 0) {
        mvpRows.push({
          section_type: "local_events",
          position: 3,
          headline: "A Few Things Happening Around Town",
          body: buildLocalEventsBody(publishableEvents, { editionCity: city }),
          source_note: "Curated from trusted local event sources",
        });
      }
    }

    mvpRows.sort((a, b) => a.position - b.position);

    const checkpoint = await publishMinimumViableEditionCheckpoint(supabaseAdmin, {
      traceId: options.editionTraceId,
      userId,
      editionDate,
      metroKey: editionMetroKey,
      editionCore: {
        editorial_context: editorialContext,
        lead_story: leadStory,
        bandit,
        discovery: JSON.parse(JSON.stringify(discoveryWithImages)),
        knowledge: JSON.parse(JSON.stringify(knowledgeWithGrounding)),
        memory: JSON.parse(JSON.stringify(memory)),
      },
      sectionRows: mvpRows,
    });

    console.log("[buildEdition] MVP checkpoint", {
      traceId: options.editionTraceId ?? null,
      ok: checkpoint.ok,
      markedReady: checkpoint.ok ? checkpoint.markedReady : false,
      sectionCount: checkpoint.ok ? checkpoint.sectionCount : 0,
      elapsedMs: Math.round(performance.now() - mvpCheckpointStart),
    });
  } catch (mvpErr) {
    console.warn("[buildEdition] MVP checkpoint skipped", {
      traceId: options.editionTraceId ?? null,
      error: mvpErr instanceof Error ? mvpErr.message : String(mvpErr),
    });
  }

  const seasonMonth = new Date(`${editionDate}T12:00:00`).getMonth();
  const seasonHint =
    seasonMonth === 2
      ? "Early spring light — a good morning to read slowly."
      : seasonMonth === 5
      ? "Summer’s first stretch — the paper keeps an easy pace."
      : seasonMonth === 8
      ? "Autumn arrives quietly — worth a slower cup with the edition."
      : seasonMonth === 11
      ? "Winter’s threshold — the paper is good company indoors."
      : null;

  const morningEdition: MorningEditionPayload = await timer.timed(
    "AI Summaries - Morning Edition Polish",
    () =>
      runMorningEditionDecisions(
      {
        editionDate,
        now: new Date(),
        location: { city, region, state },
        reader: { firstName: banditReader.firstName },
        editionMode: editorial.policy.mode,
        modeLabel: editorial.calendar.modeLabel,
        isWeekend: editorial.calendar.isWeekend,
        isSunday: editorial.calendar.isSunday,
        weatherSummary,
        signals: {
          hasBreakingNews: editorialContext.signals.hasBreakingNews,
          hasLocalEvents: editorialContext.signals.hasLocalEvents,
          weatherChange: editorialContext.signals.weatherChange,
          holidayTomorrow: editorialContext.signals.holidayTomorrow,
          primaryInterests: editorialContext.signals.primaryInterests,
          sourceDiversity: editorialContext.signals.sourceDiversity,
          topicDiversity: editorialContext.signals.topicDiversity,
          geoBalance: editorialContext.signals.geoBalance,
        },
        lead: leadStory
          ? {
              headline: leadStory.headline,
              summary: leadStory.summary,
              role: leadStory.role,
              source: leadStory.source,
              strategy: leadStory.selection.strategy,
              reasons: leadStory.selection.reasons,
            }
          : null,
        topStoryHeadlines: topStories.map((s) => s.story.title),
        editorialNotes: editorial.decisions.editorNotes,
        editorBrief: editorialContext.editorBrief,
        personalization: {
          interests: personalization.interests.length
            ? personalization.interests
            : interests,
          favoriteSources: personalization.favoriteSources,
          confidence: personalization.affinities.confidence,
        },
        discoveryBrief: discovery.editorBrief,
        discoveryPicks: discovery.picks.map((p) => ({
          title: p.title,
          category: p.category,
          why: p.why,
        })),
        knowledgeBrief: knowledgeWithGrounding.editorBrief,
        knowledgeHighlights: knowledgeWithGrounding.highlights.map((h) => ({
          headline: h.headline,
          facetType: h.facetType,
          why: h.why,
        })),
        memoryBrief: memory.editorBrief,
        sinceYouLastRead: memory.sinceYouLastRead,
        continuityDays: memory.reader.continuityDays,
        unfinishedTitles: memory.threads
          .filter((t) => t.type === "unfinished_reading")
          .map((t) => t.data?.headline || t.title)
          .filter(Boolean) as string[],
        localEvents: localEvents.map((e) => ({
          name: e.name,
          venue: e.venue,
          city: e.city,
        })),
        onThisDay,
        banditLine: bandit.morning.line,
        seasonHint,
      },
      anthropicApiKey
      )
  );

  // The front-page hero line beneath the masthead reads `opening_20s`. An
  // AI-polished opener — however carefully prompted — kept drifting toward
  // "Inside this morning's edition..." summary phrasing that competes with
  // the front page instead of stepping aside for it. Swap in a handcrafted,
  // deterministically-rotated line instead: never AI, never a story
  // summary, stable per reader per day. briefing_60s / overview_3m (not
  // shown on the front page today) are untouched.
  morningEdition.briefings.opening_20s = composeHeroOpening({
    editionDate,
    userId,
    location: { city, region, state },
    weather:
      weatherConditionCode != null || weather?.current?.temperature_2m != null
        ? {
            currentTempC: weather?.current?.temperature_2m ?? null,
            conditionCode: weatherConditionCode,
          }
        : null,
    readerFirstName: banditReader.firstName,
  });
  morningEdition.selectionMeta.editorNotes.push(
    "opening_20s replaced with a handcrafted, non-AI hero line (see heroOpening.ts)"
  );

  const { data: priorEditionRow } = await supabaseAdmin
    .from("editions")
    .select("morning_edition, discovery")
    .eq("user_id", userId)
    .eq("edition_date", editionDate)
    .eq("metro_key", editionMetroKey)
    .maybeSingle();
  const priorMorningHero =
    priorEditionRow?.morning_edition &&
    typeof priorEditionRow.morning_edition === "object"
      ? ((priorEditionRow.morning_edition as { morningHero?: MorningHeroExperience })
          .morningHero ?? null)
      : null;
  const priorDiscoveryCity =
    priorEditionRow?.discovery &&
    typeof priorEditionRow.discovery === "object" &&
    (priorEditionRow.discovery as { location?: { city?: string } }).location?.city?.trim()
      ? String(
          (priorEditionRow.discovery as { location?: { city?: string } }).location!.city
        ).trim()
      : null;
  const priorCityMatchesCurrent =
    !priorDiscoveryCity ||
    priorDiscoveryCity.toLowerCase() === location.city.trim().toLowerCase();

  let morningHero: MorningHeroExperience | null = null;
  try {
    const nationalHero = usNationalDaily?.todayMasterpiece?.presentation ?? null;
    morningHero = nationalHero;
    if (morningHero) {
      if (!isMorningHeroDetailComplete(morningHero.detail)) {
        console.warn("[buildEdition] morning hero rejected — incomplete detail article", {
          editionDate,
          artworkId: morningHero.artworkId,
        });
        morningEdition.selectionMeta.editorNotes.push(
          "hero_artwork: rejected — masterpiece detail article incomplete"
        );
        morningHero = null;
      } else {
        (morningEdition as MorningEditionPayload & {
          morningHero?: MorningHeroExperience | null;
        }).morningHero = morningHero;
        morningEdition.selectionMeta.usedEngines.push("hero_artwork");
        morningEdition.selectionMeta.editorNotes.push(
          `Daily hero artwork: ${morningHero.artworkTitle} by ${morningHero.artist}`
        );
      }
    } else {
      morningEdition.selectionMeta.editorNotes.push(
        "hero_artwork: national daily layer empty or no hosted artwork eligible for selection"
      );
    }

    if (
      !morningHero &&
      priorCityMatchesCurrent &&
      priorMorningHero?.hostedUrl?.trim() &&
      priorMorningHero.aboutArtworkBody?.trim()
    ) {
      morningHero = priorMorningHero;
      (morningEdition as MorningEditionPayload & {
        morningHero?: MorningHeroExperience | null;
      }).morningHero = morningHero;
      morningEdition.selectionMeta.editorNotes.push(
        "hero_artwork: preserved frozen morning hero from prior edition row (same city)"
      );
    } else if (!morningHero && priorMorningHero && !priorCityMatchesCurrent) {
      morningEdition.selectionMeta.editorNotes.push(
        `hero_artwork: skipped prior morning hero — city changed (${priorDiscoveryCity} → ${location.city})`
      );
    }
  } catch (heroErr) {
    console.warn("[buildEdition] morning hero artwork skipped", heroErr);
    morningEdition.selectionMeta.editorNotes.push(
      "hero_artwork: skipped — discovery or persistence unavailable"
    );
  }

  console.log("[buildEdition] morning edition", {
    engines: morningEdition.selectionMeta.usedEngines,
    polishedWithAi: morningEdition.selectionMeta.polishedWithAi,
    openingWords: morningEdition.briefings.opening_20s.wordCount,
    briefingWords: morningEdition.briefings.briefing_60s.wordCount,
  });

  let historyAroundTown = null;
  try {
    historyAroundTown = await buildHistoryAroundTownForEdition(supabaseAdmin, {
      city,
      region,
      state,
    });
    if (historyAroundTown) {
      morningEdition.selectionMeta.usedEngines.push("history_around_town");
      morningEdition.selectionMeta.editorNotes.push(
        `History Around Town: ${historyAroundTown.carousel.length} carousel / ${historyAroundTown.places.length} total places`
      );
    } else {
      morningEdition.selectionMeta.editorNotes.push(
        "history_around_town: no approved places in library for this metro"
      );
    }
  } catch (historyErr) {
    console.warn("[buildEdition] history around town skipped", historyErr);
    morningEdition.selectionMeta.editorNotes.push(
      "history_around_town: skipped — library unavailable"
    );
  }

  // Rebuild editorial context with Morning Edition notes for storage.
  const editorialContextWithMorning = buildEditionEditorialContext({
    editionDate,
    location: {
      city,
      region,
      state,
    },
    interests: personalization.interests.length
      ? personalization.interests
      : interests,
    followedTopics,
    favoriteSources: personalization.favoriteSources,
    skippedTopics: personalization.skippedTopics,
    personalizationConfidence: personalization.affinities.confidence,
    weather: weather?.current
      ? {
          currentTempC: weather.current.temperature_2m,
          todayHighC: weather.daily?.temperature_2m_max?.[0] ?? null,
          todayLowC: weather.daily?.temperature_2m_min?.[0] ?? null,
          tomorrowHighC: weather.daily?.temperature_2m_max?.[1] ?? null,
          tomorrowLowC: weather.daily?.temperature_2m_min?.[1] ?? null,
        }
      : null,
    frontPage: {
      stories: frontPageStoriesForDesk,
      composition: frontPage.selectionMeta.composition ?? null,
      editorialDecisions: editorial.decisions,
    },
    localEvents,
    onThisDay,
    discovery: {
      picks: discoveryForBuild.picks,
      surfaces: Object.keys(discoveryForBuild.surfaces),
      editorNotes: discoveryForBuild.selectionMeta.editorNotes,
    },
    knowledge: {
      storyCount: knowledgeWithGrounding.selectionMeta.storyCount,
      facetCount: knowledgeWithGrounding.selectionMeta.facetCount,
      highlights: knowledgeWithGrounding.highlights,
      editorNotes: knowledgeWithGrounding.selectionMeta.editorNotes,
    },
    memory: {
      threadCount: memory.selectionMeta.threadCount,
      continuityDays: memory.reader.continuityDays,
      sinceYouLastRead: memory.sinceYouLastRead,
      highlights: memory.highlights,
      editorNotes: memory.selectionMeta.editorNotes,
    },
    morningEdition: {
      usedEngines: morningEdition.selectionMeta.usedEngines,
      polishedWithAi: morningEdition.selectionMeta.polishedWithAi,
      openingPreview: morningEdition.briefings.opening_20s.text,
      briefingPreview: morningEdition.briefings.briefing_60s.text,
      editorNotes: morningEdition.selectionMeta.editorNotes,
    },
    now: new Date(),
  });

  const catalogBootstrap = editionMarket
    ? await getCatalogBootstrapState(supabaseAdmin, catalogMetroKey)
    : null;

  const deskGapReport = buildEditionDeskGapReport({
    city: location.city,
    catalogMetroKey,
    market: editionMarket,
    catalogBootstrap: catalogBootstrap ?? undefined,
    leadStoryPresent: Boolean(leadStory),
    topStoriesCount: topStories.length,
    banditsPickPresent: Boolean(banditsPick),
    morningHeroPresent: Boolean(morningHero),
    localEventsCount: localEvents.length,
    discoverySurfaces: discoveryWithImages.surfaces ?? {},
    localPlacesCount: localPlaces.length,
    localPlacesFilteredCount: localPlacesFiltered.length,
  });

  logEditionDeskGapReport({
    traceId: options.editionTraceId,
    editionId: "pending",
    report: deskGapReport,
  });

  const editionUpsertFields: Record<string, unknown> = {
    editorial_context: editorialContextWithMorning,
    lead_story: leadStory,
    national_news: usNationalDaily?.nationalNews ?? null,
    bandit,
    discovery: JSON.parse(JSON.stringify(discoveryWithImages)),
    knowledge: JSON.parse(JSON.stringify(knowledgeWithGrounding)),
    memory: JSON.parse(JSON.stringify(memory)),
    morning_edition: JSON.parse(JSON.stringify(morningEdition)),
    history_around_town: historyAroundTown
      ? JSON.parse(JSON.stringify(historyAroundTown))
      : null,
  };
  for (const [field, value] of Object.entries(editionUpsertFields)) {
    try {
      JSON.stringify(value);
    } catch (err) {
      return {
        ok: false,
        error: `edition_field_${field}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      };
    }
  }

  // Written as "processing" and only flipped to "ready" after edition_sections
  // is confirmed written below. Every reader in the app (home, library,
  // adjacent-editions, refresh-discovery, refresh-local-event-images) treats
  // status='ready' as a promise that sections exist — writing "ready" here
  // upfront made that promise false whenever the process died between this
  // upsert and the sections insert (Edge Function timeout, crash), leaving a
  // "ready" edition with zero sections that would never be regenerated
  // (enqueue only skips users who already have a ready edition).
  const editionWriteStart = performance.now();
  const upsertCore = {
    user_id: userId,
    edition_date: editionDate,
    metro_key: editionMetroKey,
    status: "processing" as const,
    us_national_daily_id: usNationalDaily?.id ?? null,
    editorial_context: editorialContextWithMorning,
    lead_story: leadStory,
    bandit,
    discovery: editionUpsertFields.discovery,
    knowledge: editionUpsertFields.knowledge,
    memory: editionUpsertFields.memory,
    morning_edition: editionUpsertFields.morning_edition,
    history_around_town: editionUpsertFields.history_around_town,
  };

  let { data: edition, error: editionError } = await supabaseAdmin
    .from("editions")
    .upsert(upsertCore, { onConflict: editionConflictTarget })
    .select()
    .single();

  if (editionError && /invalid json/i.test(editionError.message)) {
    const preservedMorningEdition =
      editionUpsertFields.morning_edition ??
      priorEditionRow?.morning_edition ??
      null;
    const stripAttempts: Array<{
      label: string;
      payload: Record<string, unknown>;
    }> = [
      {
        label: "without_knowledge",
        payload: (() => {
          const p = { ...upsertCore };
          delete (p as { knowledge?: unknown }).knowledge;
          if (preservedMorningEdition) {
            (p as { morning_edition?: unknown }).morning_edition =
              preservedMorningEdition;
          }
          return p;
        })(),
      },
      {
        label: "without_memory",
        payload: (() => {
          const p = { ...upsertCore };
          delete (p as { knowledge?: unknown }).knowledge;
          delete (p as { memory?: unknown }).memory;
          if (preservedMorningEdition) {
            (p as { morning_edition?: unknown }).morning_edition =
              preservedMorningEdition;
          }
          return p;
        })(),
      },
      {
        label: "without_discovery",
        payload: (() => {
          const p = { ...upsertCore };
          delete (p as { knowledge?: unknown }).knowledge;
          delete (p as { memory?: unknown }).memory;
          delete (p as { discovery?: unknown }).discovery;
          if (preservedMorningEdition) {
            (p as { morning_edition?: unknown }).morning_edition =
              preservedMorningEdition;
          }
          return p;
        })(),
      },
      {
        label: "core_only",
        payload: {
          user_id: userId,
          edition_date: editionDate,
          metro_key: editionMetroKey,
          status: "processing",
          editorial_context: editorialContextWithMorning,
          lead_story: leadStory,
          bandit,
          ...(preservedMorningEdition
            ? { morning_edition: preservedMorningEdition }
            : {}),
        },
      },
    ];

    for (const attempt of stripAttempts) {
      console.warn("[buildEdition] edition upsert retry", {
        label: attempt.label,
        priorError: editionError.message,
      });
      const retry = await supabaseAdmin
        .from("editions")
        .upsert(attempt.payload, { onConflict: editionConflictTarget })
        .select()
        .single();
      if (!retry.error) {
        edition = retry.data;
        editionError = null;
        console.warn("[buildEdition] edition upsert recovered", {
          label: attempt.label,
        });
        break;
      }
      editionError = retry.error;
    }
  }

  // Pre-migration fallback if new columns are missing.
  if (
    editionError &&
    (/bandit/i.test(editionError.message) ||
      /discovery/i.test(editionError.message) ||
      /knowledge/i.test(editionError.message) ||
      /memory/i.test(editionError.message) ||
      /morning_edition/i.test(editionError.message))
  ) {
    console.log("[buildEdition] optional column missing — upserting core fields", {
      message: editionError.message,
    });
    const fallback = await supabaseAdmin
      .from("editions")
      .upsert(
        {
          user_id: userId,
          edition_date: editionDate,
          metro_key: editionMetroKey,
          status: "processing",
          editorial_context: editorialContextWithMorning,
          lead_story: leadStory,
          bandit,
          discovery: discoveryWithImages,
          knowledge: knowledgeWithGrounding,
          memory,
        },
        { onConflict: editionConflictTarget }
      )
      .select()
      .single();
    edition = fallback.data;
    editionError = fallback.error;

    if (
      editionError &&
      (/discovery/i.test(editionError.message) ||
        /knowledge/i.test(editionError.message) ||
        /memory/i.test(editionError.message) ||
        /morning_edition/i.test(editionError.message))
    ) {
      const core = await supabaseAdmin
        .from("editions")
        .upsert(
          {
            user_id: userId,
            edition_date: editionDate,
            metro_key: editionMetroKey,
            status: "processing",
            editorial_context: editorialContextWithMorning,
            lead_story: leadStory,
            bandit,
          },
          { onConflict: editionConflictTarget }
        )
        .select()
        .single();
      edition = core.data;
      editionError = core.error;
    }
  }

  timer.record("Database Write - Edition Upsert", performance.now() - editionWriteStart);

  if (editionError || !edition) {
    return {
      ok: false,
      error: `edition_upsert: ${editionError?.message ?? "Could not create edition"}`,
    };
  }

  const sectionsWriteStart = performance.now();
  const cityArticle = await fetchApprovedCityArticle(supabaseAdmin, {
    city,
    state,
    region,
    lat: weatherLat,
    lon: weatherLon,
  });

  const { data: existingSections, error: existingSectionsError } =
    await supabaseAdmin
      .from("edition_sections")
      .select("section_type, headline, body, source_note, position")
      .eq("edition_id", edition.id);

  if (existingSectionsError) {
    console.warn("[buildEdition] edition_sections pre-delete read failed", {
      editionId: edition.id,
      error: existingSectionsError.message,
    });
  }

  if (editionMarket && existingSections?.length) {
    const preDeleteAudits = (existingSections as EditionSectionWriteRow[]).map(
      (row) =>
        auditEditionSectionRow({
          row: {
            edition_id: edition.id,
            section_type: row.section_type,
            position: row.position,
            headline: row.headline,
            body: row.body,
            source_note: row.source_note,
          },
          market: editionMarket,
          catalogMetroKey,
          anchor: marketAnchor,
        })
    );
    logEditionSectionWriteAudit({
      traceId: options.editionTraceId,
      phase: "pre_delete",
      editionId: edition.id,
      market: editionMarket,
      catalogMetroKey,
      anchor: marketAnchor,
      audits: preDeleteAudits,
      existingSectionCount: existingSections.length,
      existingSectionTypes: existingSections.map((s) => s.section_type),
    });
    const staleCrossMetro = preDeleteAudits.filter((a) => a.crossMetroRejected);
    if (staleCrossMetro.length > 0) {
      console.error("[buildEdition] stale cross-metro edition_sections before delete", {
        traceId: options.editionTraceId ?? null,
        editionId: edition.id,
        buildMetroKey: editionMarket.metroKey,
        catalogMetroKey,
        buildCity: location.city,
        staleSections: staleCrossMetro.map((a) => ({
          sectionType: a.sectionType,
          sampleCities: a.sampleCities,
          sourceCatalog: a.sourceCatalog,
          rejectReason: a.rejectReason,
        })),
        likelyCause:
          "prior build left edition_sections rows (delete failed or build aborted after edition upsert)",
      });
    }
  }

  const { error: deleteError, count: deletedCount } = await supabaseAdmin
    .from("edition_sections")
    .delete({ count: "exact" })
    .eq("edition_id", edition.id);

  console.log("[buildEdition] edition_sections delete", {
    editionId: edition.id,
    deletedCount: deletedCount ?? null,
    error: deleteError?.message ?? null,
  });

  if (deleteError) {
    logEditionSectionWriteAudit({
      traceId: options.editionTraceId,
      phase: "pre_delete",
      editionId: edition.id,
      market: editionMarket!,
      catalogMetroKey,
      anchor: marketAnchor,
      deleteError: deleteError.message,
      existingSectionCount: existingSections?.length ?? null,
    });
    await supabaseAdmin
      .from("editions")
      .update({ status: "failed" })
      .eq("id", edition.id);
    logTimingSummary(timer);
    return {
      ok: false,
      error: `edition_sections_delete: ${deleteError.message}`,
    };
  }

  const { data: remainingSections, error: remainingSectionsError } =
    await supabaseAdmin
      .from("edition_sections")
      .select("section_type")
      .eq("edition_id", edition.id);

  if (remainingSectionsError) {
    console.warn("[buildEdition] edition_sections post-delete read failed", {
      editionId: edition.id,
      error: remainingSectionsError.message,
    });
  } else if (remainingSections?.length) {
    console.error("[buildEdition] stale edition_sections survived delete", {
      traceId: options.editionTraceId ?? null,
      editionId: edition.id,
      remainingCount: remainingSections.length,
      remainingTypes: remainingSections.map((s) => s.section_type),
    });
    await supabaseAdmin
      .from("editions")
      .update({ status: "failed" })
      .eq("id", edition.id);
    logTimingSummary(timer);
    return {
      ok: false,
      error: `edition_sections_delete_incomplete: ${remainingSections.length} stale rows remain`,
    };
  }

  const rows = sections
    .map((s, i) => ({
      edition_id: edition.id,
      section_type: s.section_type,
      position: s.position,
      headline: written[i].headline,
      body: written[i].body,
      source_note:
        s.section_type === "top_stories"
          ? "Sourced from NewsAPI"
          : s.section_type === "today_in_history"
          ? "Sourced from Wikipedia"
          : s.section_type === "weather" || s.section_type === "looking_ahead"
          ? "Sourced from Open-Meteo"
          : null,
    }))
    .filter((r) => r.headline && r.body);

  if (cityArticle) {
    rows.push({
      edition_id: edition.id,
      section_type: "story_of",
      position: 5,
      headline: cityArticle.headline,
      body: cityArticle.body,
      source_note: cityArticleSourceNote(cityArticle),
    });
    console.log("[buildEdition] story of section persisted", {
      metroKey: cityArticle.metroKey,
      headline: cityArticle.headline.slice(0, 60),
      wordCount: cityArticle.body.split(/\s+/).filter(Boolean).length,
    });
  }

  if (localEvents.length > 0) {
    const publishableEvents = assertEventsVerifiedForPublication(localEvents, {
      now: new Date(),
      location: eventsLocation,
      eventTimezone,
      editionDate,
    });

    if (publishableEvents.length === 0) {
      console.log("[buildEdition] local events publish gate removed entire section", {
        beforeGate: localEvents.length,
      });
    } else {
    const localEventsBody = buildLocalEventsBody(publishableEvents, {
      editionCity: city,
    });
    const persistedCount = (() => {
      try {
        const parsed = JSON.parse(localEventsBody) as { events?: unknown[] };
        return Array.isArray(parsed.events) ? parsed.events.length : 0;
      } catch {
        return publishableEvents.length;
      }
    })();
    console.log("[buildEdition] local events persisted", {
      qualified: publishableEvents.length,
      persistedInBody: persistedCount,
      topEvent: publishableEvents[0]?.name?.slice(0, 48) ?? null,
      topScore: publishableEvents[0]?.editorialScore?.total ?? null,
    });
    rows.push({
      edition_id: edition.id,
      section_type: "local_events",
      position: 3,
      headline: "A Few Things Happening Around Town",
      body: localEventsBody,
      source_note: "Curated from trusted local event sources",
    });
    }
  }

  if (heroWeatherTag) {
    rows.push({
      edition_id: edition.id,
      section_type: "weather",
      position: 1,
      headline: heroWeatherTag,
      body: heroWeatherTag,
      source_note: weatherAttribution,
    });
  }

  if (usNationalDaily?.todayInHistory) {
    rows.push({
      edition_id: edition.id,
      section_type: "today_in_history",
      position: 4,
      headline: usNationalDaily.todayInHistory.headline,
      body: usNationalDaily.todayInHistory.body,
      source_note: usNationalDaily.todayInHistory.sourceNote,
    });
    console.log("[buildEdition] today in history persisted from national daily", {
      nationalDailyId: usNationalDaily.id,
      headline: usNationalDaily.todayInHistory.headline.slice(0, 60),
    });
  }

  if (rows.some((r) => r.section_type === "local_events" || r.section_type === "weather")) {
    rows.sort((a, b) => a.position - b.position);
  }

  console.log("[buildEdition] rows after headline/body filter", {
    beforeFilter: sections.length,
    afterFilter: rows.length,
    insertedTypes: rows.map((r) => r.section_type),
  });

  let rowsToInsert = rows as EditionSectionWriteRow[];
  let sectionInsertAudits: ReturnType<typeof auditEditionSectionRow>[] = [];

  if (editionMarket) {
    const filtered = filterEditionSectionRowsByMarket({
      rows: rowsToInsert,
      market: editionMarket,
      catalogMetroKey,
      anchor: marketAnchor,
    });
    sectionInsertAudits = filtered.audits;
    if (filtered.rejected.length > 0) {
      console.warn("[buildEdition] cross-metro edition sections rejected", {
        traceId: options.editionTraceId ?? null,
        editionId: edition.id,
        metroKey: editionMarket.metroKey,
        catalogMetroKey,
        rejected: filtered.rejected,
      });
      await supabaseAdmin
        .from("editions")
        .update({ status: "failed" })
        .eq("id", edition.id);
      logTimingSummary(timer);
      return {
        ok: false,
        error: `edition_sections_cross_metro: ${filtered.rejected
          .map((r) => `${r.sectionType}:${r.rejectReason}`)
          .join("; ")}`,
      };
    }
    rowsToInsert = filtered.kept;
    logEditionSectionWriteAudit({
      traceId: options.editionTraceId,
      phase: "pre_insert",
      editionId: edition.id,
      market: editionMarket,
      catalogMetroKey,
      anchor: marketAnchor,
      audits: sectionInsertAudits,
    });
  }

  logEditionDeskGapReport({
    traceId: options.editionTraceId,
    editionId: edition.id,
    report: deskGapReport,
  });

  // Confirmed bug path: empty insert was treated as success, leaving a ready
  // edition with zero sections (home empty state).
  if (rowsToInsert.length === 0) {
    await supabaseAdmin
      .from("editions")
      .update({ status: "failed" })
      .eq("id", edition.id);

    logTimingSummary(timer);

    return {
      ok: false,
      error:
        "No edition sections were written (Anthropic returned empty or unparsable copy for every section)",
    };
  }

  const { error: sectionsError } = await supabaseAdmin
    .from("edition_sections")
    .insert(rowsToInsert);

  console.log("[buildEdition] edition_sections insert", {
    attempted: rowsToInsert.length,
    rejectedCrossMetro: sectionInsertAudits.filter((a) => a.crossMetroRejected)
      .length,
    error: sectionsError?.message ?? null,
    errorCode: sectionsError?.code ?? null,
  });

  if (editionMarket) {
    logEditionSectionWriteAudit({
      traceId: options.editionTraceId,
      phase: "post_insert",
      editionId: edition.id,
      market: editionMarket,
      catalogMetroKey,
      anchor: marketAnchor,
      audits: sectionInsertAudits,
      insertError: sectionsError?.message ?? null,
    });
  }

  timer.record("Database Write - Sections", performance.now() - sectionsWriteStart);

  if (sectionsError) {
    await supabaseAdmin
      .from("editions")
      .update({ status: "failed" })
      .eq("id", edition.id);

    logTimingSummary(timer);
    return { ok: false, error: `edition_sections: ${sectionsError.message}` };
  }

  const heroLibrary = await listReadyHeroArtworkLibrary(supabaseAdmin);
  const buildComplete = await assessPersistedEditionRow(supabaseAdmin, edition.id, {
    morningEdition: editionUpsertFields.morning_edition,
    libraryHasHeroArtwork: heroLibrary.length > 0,
  });

  const { data: statusRow } = await supabaseAdmin
    .from("editions")
    .select("status")
    .eq("id", edition.id)
    .maybeSingle();
  const editionAlreadyReady = statusRow?.status === "ready";

  if (!buildComplete.complete) {
    console.warn("[buildEdition] persisted row completeness gaps", {
      editionId: edition.id,
      insertedTypes: rowsToInsert.map((r) => r.section_type),
      discoverySurfaceItems: discoverySurfaceItemCount(discoveryWithImages),
      reasons: buildComplete.reasons,
      editionAlreadyReady,
    });
    if (!editionAlreadyReady) {
      await supabaseAdmin
        .from("editions")
        .update({ status: "failed" })
        .eq("id", edition.id);

      logTimingSummary(timer);
      return {
        ok: false,
        error: `Edition incomplete — not marking ready: ${buildComplete.reasons.join("; ")}`,
      };
    }
  }

  // Only flip to ready when not already published via MVP checkpoint.
  if (!editionAlreadyReady) {
    const { error: readyError } = await supabaseAdmin
      .from("editions")
      .update({ status: "ready" })
      .eq("id", edition.id);

    if (readyError) {
      logTimingSummary(timer);
      return { ok: false, error: readyError.message };
    }
  } else {
    // Refresh full row while keeping ready — optional desks may have landed.
    await supabaseAdmin
      .from("editions")
      .update({
        editorial_context: editionUpsertFields.editorial_context,
        lead_story: editionUpsertFields.lead_story,
        bandit: editionUpsertFields.bandit,
        discovery: editionUpsertFields.discovery,
        knowledge: editionUpsertFields.knowledge,
        memory: editionUpsertFields.memory,
        morning_edition: editionUpsertFields.morning_edition,
        history_around_town: editionUpsertFields.history_around_town,
      })
      .eq("id", edition.id);
  }

  logTimingSummary(timer);

  return { ok: true, editionId: edition.id, metroKey: editionMetroKey };
}

/**
 * Print the per-step timing audit in the exact "Weather ... 1.2s" style —
 * this is what answers "where did the 90-120s go" on every real build.
 * Buckets mirror the categories in the performance audit: some entries were
 * gathered concurrently (inside a Promise.all), so per-bucket seconds can
 * add up to more than the wall-clock Total — that overlap is expected and
 * is called out below the report itself.
 */
function logTimingSummary(timer: ReturnType<typeof createTimer>) {
  const entries = timer.entries;
  const totalMs = timer.elapsedMs();

  const buckets: Array<{ label: string; prefixes: string[] }> = [
    { label: "Location + Profile Reads", prefixes: [
      "Location Resolution", "Profile Reads - Consolidated", "Recent Story Keys",
      "Recent Discovery Keys", "Personalization Profile", "Memory Archive",
      "Bandit Reader Profile",
    ] },
    { label: "Weather", prefixes: ["Weather"] },
    { label: "News", prefixes: ["News"] },
    { label: "Events", prefixes: ["Local Events"] },
    { label: "Food & Drink", prefixes: ["Food & Drink", "Recommendations"] },
    { label: "Today in History", prefixes: ["Today in History"] },
    // "AI Summaries" intentionally excludes "AI Summaries - Morning Edition
    // Polish" (listed explicitly below, not via a blanket prefix) so the
    // Editorial Opening line below isn't double-counted into this bucket too.
    { label: "AI Summaries", prefixes: [
      "AI Summaries - Story Editor", "AI Summaries - Section Writing",
    ] },
    { label: "Bandit Payload (deterministic)", prefixes: ["Bandit Payload"] },
    { label: "Editorial Opening (AI)", prefixes: ["AI Summaries - Morning Edition Polish"] },
    { label: "Database Writes", prefixes: ["Database Write"] },
  ];

  const rows = buckets
    .map((b) => ({ label: b.label, ms: sumByPrefix(entries, b.prefixes) }))
    .filter((r) => r.ms > 0);
  rows.push({ label: "Total", ms: totalMs });

  console.log(
    "\n[buildEdition] ===== TIMING REPORT =====\n" +
      formatTimingReport(rows) +
      "\n[buildEdition] (Weather/News/Events/Recommendations run concurrently, " +
      "so their sum can exceed Total — see per-entry [buildEdition] timing logs " +
      "above for exact overlap.)\n" +
      "[buildEdition] (No 'Image processing' line: event/place images are URLs " +
      "already returned by SerpAPI/Foursquare, never fetched or transformed " +
      "server-side. Hero image selection runs client-side after the edition " +
      "loads, so it's outside this pipeline's generation time.)\n" +
      "[buildEdition] ===========================\n"
  );
}
