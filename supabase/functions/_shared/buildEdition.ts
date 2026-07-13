// Shared edition builder for Kindred Edge Functions.
// Gathers real, checkable data, then asks Claude to write each section
// strictly from that data. Never invents a fact that wasn't retrieved.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { primaryNewsCategory } from "./stories/sources.ts";
import { buildEditionEditorialContext, buildLookingAheadGrounding } from "./editorial/index.ts";
import { loadPersonalizationProfile } from "./personalization/index.ts";
import { generateBanditPayload, loadBanditReaderProfile } from "./bandit/index.ts";
import {
  composeBanditsPickIntro,
  selectBanditsPick,
} from "./bandit/selectPick.ts";
import type { BanditsPick } from "./bandit/types.ts";
import { runEditorialDecisions } from "./editor/index.ts";
import { runDiscoveryDecisions } from "./discovery/index.ts";
import type { DiscoveryPayload } from "./discovery/types.ts";
import { runKnowledgeDecisions } from "./knowledge/index.ts";
import type { KnowledgePayload, KnowledgeStoryInput } from "./knowledge/types.ts";
import {
  loadMemoryArchive,
  runMemoryDecisions,
} from "./memory/index.ts";
import type { MemoryPayload, MemoryStoryInput } from "./memory/types.ts";
import { runMorningEditionDecisions } from "./morningEdition/index.ts";
import type { MorningEditionPayload } from "./morningEdition/types.ts";
import {
  formatTempC,
  formatWeatherSummary,
  resolveTemperatureUnit,
  unitInstruction,
  type TemperatureUnit,
  type TemperatureUnitPreference,
} from "./weather/units.ts";
import { runStoryEditorSafe } from "./storyEditor/index.ts";
import type { LeadStory } from "./leadStory/types.ts";
import {
  buildLocalEventsBody,
  getLocalEvents,
  type LocalEvent,
} from "./localEvents/provider.ts";
import { enrichEventsWithBanditNotes } from "./localEvents/banditNotes.ts";
import { isUsHolidayOrEve } from "./calendar/holidays.ts";
import { getLocalPlaces } from "./places/index.ts";

export type { LocalEvent } from "./localEvents/provider.ts";
export {
  buildLocalEventsBody,
  getLocalEvents,
  pickProviderEventImage,
  splitEventSchedule,
} from "./localEvents/provider.ts";
export { enrichEventsWithBanditNotes } from "./localEvents/banditNotes.ts";

export type BuildEditionResult =
  | { ok: true; editionId: string }
  | { ok: false; error: string };

export type BuildEditionOptions = {
  /** Reader's local calendar date YYYY-MM-DD — preferred over UTC. */
  editionDate?: string | null;
  temperatureUnitPreference?: TemperatureUnitPreference | null;
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

async function getWeather(lat: number, lon: number) {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&forecast_days=2&timezone=auto`
  );
  console.log("[buildEdition] provider Open-Meteo", {
    httpStatus: res.status,
    ok: res.ok,
  });
  if (!res.ok) {
    return null;
  }
  return res.json();
}

async function getOnThisDay() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const res = await fetch(
    `https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/${month}/${day}`
  );
  const data = await res.json();
  const events = data.events ?? [];
  console.log("[buildEdition] provider Wikipedia", {
    httpStatus: res.status,
    ok: res.ok,
    eventCount: events.length,
  });
  if (events.length === 0) return null;
  const pick = events[Math.floor(Math.random() * Math.min(events.length, 10))];
  return { year: pick.year, text: pick.text };
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
  const parsed = text
    ? parseSectionJson(text)
    : { headline: "", body: "" };

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

/**
 * Load recent front-page / lead headlines so today’s paper avoids repetition.
 * Keys are titles, ids, and urls from the last several editions.
 */
async function loadRecentStoryKeys(
  supabaseAdmin: SupabaseClient,
  userId: string,
  limit = 10
): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("editions")
    .select("edition_date, lead_story, editorial_context")
    .eq("user_id", userId)
    .order("edition_date", { ascending: false })
    .limit(limit);

  if (error || !data?.length) {
    if (error) {
      console.log("[buildEdition] recent story keys lookup", {
        error: error.message,
      });
    }
    return [];
  }

  const keys: string[] = [];
  for (const row of data) {
    const lead = row.lead_story as {
      id?: string;
      headline?: string;
      url?: string | null;
    } | null;
    if (lead?.headline) keys.push(lead.headline);
    if (lead?.id) keys.push(lead.id);
    if (lead?.url) keys.push(lead.url);

    const ctx = row.editorial_context as {
      sections?: Array<{
        sectionType?: string;
        items?: Array<{ title?: string; id?: string }>;
      }>;
    } | null;
    const top = ctx?.sections?.find((s) => s.sectionType === "top_stories");
    for (const item of top?.items ?? []) {
      if (item.title) keys.push(item.title);
      if (item.id) keys.push(item.id);
    }
  }

  const unique = Array.from(new Set(keys.map((k) => k.trim()).filter(Boolean)));
  console.log("[buildEdition] recent story keys", {
    editionCount: data.length,
    keyCount: unique.length,
  });
  return unique;
}

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

  console.log("[buildEdition] resolved location", {
    source: locationHint?.city ? "client-or-profile" : "profile-only",
    city: location.city,
    region: location.region,
    state: location.state,
    lat: location.lat,
    lon: location.lon,
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
        loadRecentStoryKeys(supabaseAdmin, userId)
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

  const city = personalization.city ?? location.city;
  const region = personalization.region ?? location.region;
  const state = personalization.state ?? location.state;
  const followedTopics = personalization.followedTopics;

  const weatherLat = personalization.lat ?? location.lat;
  const weatherLon = personalization.lon ?? location.lon;
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

  const [weather, onThisDay, localEventsRaw, localPlaces, editorial] =
    await Promise.all([
    timer.timed("Weather", () => getWeather(weatherLat, weatherLon)),
    timer.timed("Today in History", () => getOnThisDay()),
    timer.timed("Local Events", () => getLocalEvents(eventsLocation, { isBusyDay })),
    // Shared per-metro cache (see places/cache.ts) — this call almost
    // never actually hits Foursquare; it hits the cache row for this city.
    timer.timed("Recommendations - Places", () =>
      getLocalPlaces(supabaseAdmin, eventsLocation)
    ),
    timer.timed("News - Editorial Decisions", () =>
      runEditorialDecisions({
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

  const frontPage = editorial.frontPage;
  const topStories = frontPage.stories;
  let leadStory: LeadStory | null = editorial.leadStory;

  // Bandit's Pick candidate selection is pure CPU over the already-scored
  // candidate pool — it only needs `editorial`, not the edited lead/top
  // stories. Resolving it now (instead of after the front page is fully
  // edited) lets its Story Editor pass join the SAME parallel batch below
  // instead of running afterward on its own — previously the single
  // biggest sequential AI call sitting after the front-page batch.
  const banditsPickStory = selectBanditsPick({
    scored: frontPage.scoredCandidates ?? [],
    leadId: leadStory?.id ?? null,
    frontPageIds: topStories.map((s) => s.story.id),
    interests: personalization.interests.length
      ? personalization.interests
      : interests,
    recentKeys: blendedRecentKeys,
  });

  // Story Editor — lead + every Top Story + Bandit's Pick, all in parallel,
  // alongside the (independent) Local Events Bandit Notes pass. Each Story
  // Editor call is independent (never a multi-wire mashup article) and can
  // internally retry up to STORY_EDITOR_MAX_PASSES times, so running these
  // one at a time was the single biggest reason full edition builds were
  // timing out on Supabase's compute budget. Same total work, now bounded
  // by the slowest single call instead of the sum of all of them.
  const [editedBatch, localEvents] = await Promise.all([
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
                  surfaceRole: "lead",
                  locale: "en",
                  selectionWhy: leadStory.selection.reasons
                    .map((r) => r.label)
                    .slice(0, 4),
                },
                anthropicApiKey
              )
            : Promise.resolve(null),
          banditsPickStory && anthropicApiKey
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
                surfaceRole: "top_story",
                locale: "en",
                selectionWhy: ranked.reasons.map((r) => r.label).slice(0, 3),
              },
              anthropicApiKey
            )
          ),
        ])
    ),
    timer.timed("Local Events - Bandit Notes (AI)", () =>
      enrichEventsWithBanditNotes(localEventsRaw)
    ),
  ]);
  const [editedLead, editedPick, ...editedTopStories] = editedBatch;

  if (leadStory && editedLead) {
    leadStory = {
      ...leadStory,
      headline: editedLead.headline || leadStory.headline,
      summary: editedLead.bodyText || leadStory.summary,
      body: editedLead.paragraphs,
      dek: editedLead.dek,
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
    return {
      id: ranked.story.id,
      title: edited.headline || ranked.story.title,
      description: edited.bodyText || ranked.story.description,
      dek: edited.dek,
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

  const weatherSummary = formatWeatherSummary({
    city: city ?? location.city,
    currentC: weather?.current?.temperature_2m ?? null,
    highC: weather?.daily?.temperature_2m_max?.[0] ?? null,
    lowC: weather?.daily?.temperature_2m_min?.[0] ?? null,
    unit: tempUnit,
  });

  console.log("[buildEdition] weather provider", {
    provider: "Open-Meteo",
    city: city ?? location.city,
    lat: weatherLat,
    lon: weatherLon,
    unit: tempUnit,
    summary: weatherSummary,
  });

  const discovery: DiscoveryPayload = runDiscoveryDecisions({
    editionDate,
    now: new Date(),
    city,
    region,
    state,
    interests: personalization.interests.length
      ? personalization.interests
      : interests,
    followedTopics,
    favoriteSources: personalization.favoriteSources,
    weatherSummary,
    isWeekend: editorial.calendar.isWeekend,
    isSunday: editorial.calendar.isSunday,
    localEvents,
    localPlaces,
    // A newspaper should feel abundant — 4 per surface starved sections
    // (like Recommendations) that draw from a single category surface.
    maxPerSurface: 8,
    recentKeys: recentDiscoveryKeys,
  });

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
    knowledgeStories: knowledge.selectionMeta.storyCount,
    knowledgeFacets: knowledge.selectionMeta.facetCount,
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

  if (weather?.current) {
    const current = formatTempC(weather.current.temperature_2m, tempUnit);
    const high = formatTempC(weather.daily?.temperature_2m_max?.[0], tempUnit);
    const low = formatTempC(weather.daily?.temperature_2m_min?.[0], tempUnit);
    sections.push({
      section_type: "weather",
      position: 1,
      groundingData: `Current temperature: ${current} in ${location.city}. Today's high/low: ${high}/${low}. Temperature unit: ${tempUnit}.`,
      instruction:
        `Write a brief, practical weather section. State the real numbers given. ${unitInstruction(tempUnit)} No invented details. Do not mix temperature units.`,
    });
  }

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

  if (onThisDay) {
    sections.push({
      section_type: "today_in_history",
      position: 4,
      groundingData: `In ${onThisDay.year}: ${onThisDay.text}`,
      instruction:
        "Write a brief 'Today in History' note based only on this fact.",
    });
  }

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
      position: 5,
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

  const written = await timer.timed("AI Summaries - Section Writing", () =>
    Promise.all(sections.map((section) => writeSection(section, anthropicApiKey)))
  );

  const writtenUsable = written.filter((w) => w.headline && w.body).length;
  console.log("[buildEdition] write results", {
    plannedCount: sections.length,
    usableWrittenCount: writtenUsable,
    emptyWrittenCount: sections.length - writtenUsable,
    localEventsStructured: localEvents.length > 0,
  });

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
      picks: discovery.picks,
      surfaces: Object.keys(discovery.surfaces),
      editorNotes: discovery.selectionMeta.editorNotes,
    },
    knowledge: {
      storyCount: knowledge.selectionMeta.storyCount,
      facetCount: knowledge.selectionMeta.facetCount,
      highlights: knowledge.highlights,
      editorNotes: knowledge.selectionMeta.editorNotes,
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
  // function for why that merge is safe.
  let banditsPick: BanditsPick | null = null;
  if (banditsPickStory && editedPick) {
    banditsPick = {
      intro: composeBanditsPickIntro(
        {
          ...banditsPickStory,
          headline: editedPick.headline || banditsPickStory.headline,
          summary: editedPick.bodyText || banditsPickStory.summary,
        },
        banditReader.firstName,
        editionDate
      ),
      story: {
        id: banditsPickStory.id,
        headline: editedPick.headline || banditsPickStory.headline,
        summary: editedPick.bodyText || banditsPickStory.summary,
        source: banditsPickStory.source,
        url: banditsPickStory.url,
        publishedAt: banditsPickStory.publishedAt,
        imageUrl: banditsPickStory.imageUrl,
        category: banditsPickStory.category,
        why: banditsPickStory.why,
      },
    };
    console.log("[buildEdition] storyEditor bandits_pick", {
      path: editedPick.desk.path,
      passes: editedPick.desk.passes,
      paras: editedPick.paragraphs.length,
    });
  }

  console.log("[buildEdition] bandits pick", {
    selected: Boolean(banditsPick),
    headline: banditsPick?.story.headline?.slice(0, 60) ?? null,
  });

  const bandit = await timer.timed("AI Summaries - Bandit Payload", () =>
    generateBanditPayload(
      {
        editionDate,
        now: new Date(),
        reader: banditReader,
        location: { city, region, state },
        weatherSummary,
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
  );

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
        knowledgeBrief: knowledge.editorBrief,
        knowledgeHighlights: knowledge.highlights.map((h) => ({
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

  console.log("[buildEdition] morning edition", {
    engines: morningEdition.selectionMeta.usedEngines,
    polishedWithAi: morningEdition.selectionMeta.polishedWithAi,
    openingWords: morningEdition.briefings.opening_20s.wordCount,
    briefingWords: morningEdition.briefings.briefing_60s.wordCount,
  });

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
      picks: discovery.picks,
      surfaces: Object.keys(discovery.surfaces),
      editorNotes: discovery.selectionMeta.editorNotes,
    },
    knowledge: {
      storyCount: knowledge.selectionMeta.storyCount,
      facetCount: knowledge.selectionMeta.facetCount,
      highlights: knowledge.highlights,
      editorNotes: knowledge.selectionMeta.editorNotes,
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

  const editionWriteStart = performance.now();
  let { data: edition, error: editionError } = await supabaseAdmin
    .from("editions")
    .upsert(
      {
        user_id: userId,
        edition_date: editionDate,
        status: "ready",
        editorial_context: editorialContextWithMorning,
        lead_story: leadStory,
        bandit,
        discovery,
        knowledge,
        memory,
        morning_edition: morningEdition,
      },
      { onConflict: "user_id,edition_date" }
    )
    .select()
    .single();

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
          status: "ready",
          editorial_context: editorialContextWithMorning,
          lead_story: leadStory,
          bandit,
          discovery,
          knowledge,
          memory,
        },
        { onConflict: "user_id,edition_date" }
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
            status: "ready",
            editorial_context: editorialContextWithMorning,
            lead_story: leadStory,
            bandit,
          },
          { onConflict: "user_id,edition_date" }
        )
        .select()
        .single();
      edition = core.data;
      editionError = core.error;
    }
  }

  timer.record("Database Write - Edition Upsert", performance.now() - editionWriteStart);

  if (editionError || !edition) {
    return { ok: false, error: editionError?.message ?? "Could not create edition" };
  }

  const sectionsWriteStart = performance.now();
  const { error: deleteError } = await supabaseAdmin
    .from("edition_sections")
    .delete()
    .eq("edition_id", edition.id);

  console.log("[buildEdition] edition_sections delete", {
    editionId: edition.id,
    error: deleteError?.message ?? null,
  });

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

  if (localEvents.length > 0) {
    rows.push({
      edition_id: edition.id,
      section_type: "local_events",
      position: 3,
      headline: "A Few Things Happening Around Town",
      body: buildLocalEventsBody(localEvents),
      source_note: "Sourced from Google Events",
    });
    rows.sort((a, b) => a.position - b.position);
  }

  console.log("[buildEdition] rows after headline/body filter", {
    beforeFilter: sections.length,
    afterFilter: rows.length,
    insertedTypes: rows.map((r) => r.section_type),
  });

  // Confirmed bug path: empty insert was treated as success, leaving a ready
  // edition with zero sections (home empty state).
  if (rows.length === 0) {
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

  const { error: sectionsError, count: insertCount } = await supabaseAdmin
    .from("edition_sections")
    .insert(rows)
    .select("id", { count: "exact", head: true });

  console.log("[buildEdition] edition_sections insert", {
    attempted: rows.length,
    insertCount: insertCount ?? null,
    error: sectionsError?.message ?? null,
    errorCode: sectionsError?.code ?? null,
  });

  timer.record("Database Write - Sections", performance.now() - sectionsWriteStart);

  if (sectionsError) {
    logTimingSummary(timer);
    return { ok: false, error: sectionsError.message };
  }

  logTimingSummary(timer);

  return { ok: true, editionId: edition.id };
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
    { label: "Recommendations", prefixes: ["Recommendations"] },
    { label: "Today in History", prefixes: ["Today in History"] },
    { label: "AI Summaries", prefixes: ["AI Summaries"] },
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
      "[buildEdition] ===========================\n"
  );
}
