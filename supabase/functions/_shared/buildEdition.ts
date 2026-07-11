// Shared edition builder for Kindred Edge Functions.
// Gathers real, checkable data, then asks Claude to write each section
// strictly from that data. Never invents a fact that wasn't retrieved.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export type BuildEditionResult =
  | { ok: true; editionId: string }
  | { ok: false; error: string };

type SectionInput = {
  section_type: string;
  position: number;
  groundingData: string;
  instruction: string;
};

type Location = { lat: number; lon: number; city: string };

export type LocalEvent = {
  name: string;
  startDateTime: string;
  venue: string;
  city: string;
  sourceUrl: string;
  sourceName: string;
};

const DEFAULT_LOCATION: Location = {
  lat: 37.77,
  lon: -122.42,
  city: "your area",
};

export async function getApproxLocation(req?: Request): Promise<Location> {
  if (!req) return DEFAULT_LOCATION;

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "8.8.8.8";
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`);
    const data = await res.json();
    return {
      lat: data.latitude ?? DEFAULT_LOCATION.lat,
      lon: data.longitude ?? DEFAULT_LOCATION.lon,
      city: data.city ?? DEFAULT_LOCATION.city,
    };
  } catch {
    return DEFAULT_LOCATION;
  }
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

async function getTopStories(category: string, newsApiKey: string) {
  const validCategories = [
    "business",
    "technology",
    "science",
    "health",
    "sports",
    "general",
  ];
  const cat = validCategories.includes(category) ? category : "general";
  const res = await fetch(
    `https://newsapi.org/v2/top-headlines?category=${cat}&language=en&pageSize=3&apiKey=${newsApiKey}`
  );
  const data = await res.json();
  const articles = data.articles ?? [];
  console.log("[buildEdition] provider NewsAPI", {
    httpStatus: res.status,
    ok: res.ok,
    category: cat,
    articleCount: articles.length,
    apiError: typeof data.status === "string" && data.status === "error"
      ? String(data.code ?? data.message ?? "error")
      : null,
  });
  return articles.map((a: {
    title: string;
    source?: { name?: string };
    description?: string;
  }) => ({
    title: a.title,
    source: a.source?.name,
    description: a.description,
  }));
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

/**
 * Provider-agnostic local events fetch.
 * V1 adapter: SerpApi Google Events. Swap the body later without changing callers.
 */
export async function getLocalEvents(
  location: Location
): Promise<LocalEvent[]> {
  const apiKey = Deno.env.get("EVENTS_API_KEY");
  if (!apiKey) {
    console.log("[buildEdition] getLocalEvents", {
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
    console.error("[buildEdition] getLocalEvents provider failure", {
      provider: "SerpApi Google Events",
      error: err instanceof Error ? err.message : String(err),
      rawEventCount: 0,
      filteredCount: 0,
    });
    return [];
  }
}

async function fetchLocalEventsFromSerpApi(
  location: Location,
  apiKey: string
): Promise<LocalEvent[]> {
  const cityQuery =
    location.city && location.city !== "your area"
      ? location.city
      : "San Francisco";

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

  console.log("[buildEdition] getLocalEvents", {
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
    const sourceUrl =
      ticket?.link?.trim() || event.link?.trim() || "";
    if (!sourceUrl) continue;

    const sourceName = ticket?.source?.trim() || "Google Events";

    mapped.push({
      name,
      startDateTime,
      venue,
      city: cityFromAddress || cityQuery,
      sourceUrl,
      sourceName,
    });

    if (mapped.length >= 3) break;
  }

  console.log("[buildEdition] getLocalEvents filtered", {
    provider: "SerpApi Google Events",
    rawEventCount: rawEvents.length,
    filteredCount: mapped.length,
  });

  return mapped;
}

/** Split provider schedule strings like "Sat, Jul 12, 7 – 9 PM" into date + time. */
function splitEventSchedule(startDateTime: string): {
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

function buildLocalEventsBody(events: LocalEvent[]): string {
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
      };
    }),
  });
}

export function interestToNewsCategory(interests: string[]): string {
  const map: Record<string, string> = {
    Technology: "technology",
    Business: "business",
    Science: "science",
    "Health & Wellbeing": "health",
    Sports: "sports",
  };
  for (const interest of interests) {
    if (map[interest]) return map[interest];
  }
  return "general";
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

export function createServiceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, serviceRoleKey);
}

export async function buildEditionForUser(
  supabaseAdmin: SupabaseClient,
  userId: string,
  location: Location
): Promise<BuildEditionResult> {
  const newsApiKey = Deno.env.get("NEWS_API_KEY");
  const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");

  console.log("[buildEdition] secrets present", {
    NEWS_API_KEY: Boolean(newsApiKey),
    ANTHROPIC_API_KEY: Boolean(anthropicApiKey),
    EVENTS_API_KEY: Boolean(Deno.env.get("EVENTS_API_KEY")),
  });

  if (!newsApiKey || !anthropicApiKey) {
    return { ok: false, error: "Missing NEWS_API_KEY or ANTHROPIC_API_KEY" };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("interests")
    .eq("id", userId)
    .single();

  const interests: string[] = profile?.interests ?? [];

  const [weather, topStories, onThisDay, localEvents] = await Promise.all([
    getWeather(location.lat, location.lon),
    getTopStories(interestToNewsCategory(interests), newsApiKey),
    getOnThisDay(),
    getLocalEvents(location),
  ]);

  const sections: SectionInput[] = [];

  sections.push({
    section_type: "greeting",
    position: 0,
    groundingData: `Today's date: ${new Date().toDateString()}. City: ${location.city}.`,
    instruction:
      "Write a short, warm one-line greeting for the top of the edition. Mention the day naturally. No exclamation points.",
  });

  if (weather?.current) {
    sections.push({
      section_type: "weather",
      position: 1,
      groundingData: `Current temperature: ${weather.current.temperature_2m}°C in ${location.city}. Today's high/low: ${weather.daily.temperature_2m_max[0]}°/${weather.daily.temperature_2m_min[0]}°.`,
      instruction:
        "Write a brief, practical weather section. State the real numbers given. No invented details.",
    });
  }

  if (topStories.length > 0) {
    sections.push({
      section_type: "top_stories",
      position: 2,
      groundingData: topStories
        .map(
          (s: { title: string; source?: string; description?: string }) =>
            `- ${s.title} (${s.source}): ${s.description ?? ""}`
        )
        .join("\n"),
      instruction:
        "Summarize these real headlines calmly and plainly, in your own words. Do not invent stories not listed here.",
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
    sections.push({
      section_type: "looking_ahead",
      position: 5,
      groundingData: `Tomorrow's forecast: high ${weather.daily.temperature_2m_max[1]}°, low ${weather.daily.temperature_2m_min[1]}° in ${location.city}.`,
      instruction:
        "Write a brief, practical 'Looking Ahead' note about tomorrow, grounded only in this forecast. Not generic encouragement.",
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

  const written = await Promise.all(
    sections.map((section) => writeSection(section, anthropicApiKey))
  );

  const writtenUsable = written.filter((w) => w.headline && w.body).length;
  console.log("[buildEdition] write results", {
    plannedCount: sections.length,
    usableWrittenCount: writtenUsable,
    emptyWrittenCount: sections.length - writtenUsable,
    localEventsStructured: localEvents.length > 0,
  });

  const editionDate = new Date().toISOString().slice(0, 10);

  const { data: edition, error: editionError } = await supabaseAdmin
    .from("editions")
    .upsert(
      { user_id: userId, edition_date: editionDate, status: "ready" },
      { onConflict: "user_id,edition_date" }
    )
    .select()
    .single();

  if (editionError || !edition) {
    return { ok: false, error: editionError?.message ?? "Could not create edition" };
  }

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

  if (sectionsError) {
    return { ok: false, error: sectionsError.message };
  }

  return { ok: true, editionId: edition.id };
}
