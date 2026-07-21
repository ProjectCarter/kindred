/**
 * Local News desk priority — local 24h → sports → weather → community → empty.
 * Shared by client tests and the server Local News stage.
 */

import {
  getSportsMarketById,
  SPORTS_MARKET_CATALOG,
  type HometownTeamDefinition,
} from "./hometownTeams/catalog.ts";
import {
  hoursSincePublished,
  isPressReleaseWire,
} from "./localNewsFreshness.ts";
import {
  assessLocalNewsGeographicEligibility,
  geographicTierPriority,
  hasMinimumLeadSourceMaterial,
  type LocalNewsGeographicDiagnostic,
} from "./localNewsGeographicEligibility.ts";

/** True Local News leads — published within this window only. */
export const LOCAL_NEWS_DESK_MAX_HOURS = 24;

/** Fallback desks also require this freshness (never recycle stale wires). */
export const LOCAL_NEWS_FALLBACK_MAX_HOURS = 24;

export type LocalNewsContentType =
  | "local_news"
  | "sports"
  | "weather"
  | "community";

export const LOCAL_NEWS_CONTENT_TYPE_BADGE: Record<
  LocalNewsContentType,
  string
> = {
  local_news: "📰 Local News",
  sports: "🏈 Sports",
  weather: "🌤 Weather",
  community: "🏛 Community Update",
};

export const LOCAL_NEWS_CONTENT_TYPE_PRIORITY: LocalNewsContentType[] = [
  "local_news",
  "sports",
  "weather",
  "community",
];

const WEATHER_HINTS = [
  "weather warning",
  "heat advisory",
  "heat warning",
  "air quality",
  "flood warning",
  "flash flood",
  "wildfire",
  "red flag",
  "severe weather",
  "thunderstorm",
  "tornado",
  "monsoon",
  "dust storm",
  "haboob",
  "winter storm",
  "freeze warning",
  "wind advisory",
  "storm watch",
  "nws ",
  "national weather",
];

const COMMUNITY_HINTS = [
  "city council",
  "town council",
  "city hall",
  "parks and recreation",
  "parks & recreation",
  "road closure",
  "road closures",
  "street closure",
  "public safety",
  "school district",
  "school board",
  "public meeting",
  "town hall",
  "infrastructure",
  "bond measure",
  "zoning",
  "utility outage",
  "water main",
  "police department",
  "fire department",
  "emergency management",
];

const LOCAL_OUTLET_HINTS = [
  "tribune",
  "republic",
  "gazette",
  "journal",
  "chronicle",
  "herald",
  "times",
  "news",
  "abc",
  "nbc",
  "cbs",
  "fox",
  "ktar",
  "azfamily",
  "12news",
  "3tv",
  "kpho",
  "kast",
];

const SPORTS_GENERIC_HINTS = [
  "playoff",
  "championship",
  "box score",
  "starting lineup",
  "injury report",
  "trade deadline",
  "mlb",
  "nba",
  "nfl",
  "wnba",
  "ncaa",
  "high school championship",
];

function haystack(input: {
  title?: string | null;
  description?: string | null;
  source?: string | null;
}): string {
  return `${input.title ?? ""} ${input.description ?? ""} ${input.source ?? ""}`
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(hay: string, hints: string[]): boolean {
  return hints.some((h) => hay.includes(h));
}

function resolveDeskSportsMarketId(place?: {
  city?: string | null;
  state?: string | null;
  region?: string | null;
  metroKey?: string | null;
}): string | null {
  const metro = place?.metroKey?.trim();
  if (metro) {
    for (const market of SPORTS_MARKET_CATALOG) {
      if ((market.metroKeys as readonly string[]).includes(metro)) {
        return market.id;
      }
    }
  }
  const city = (place?.city ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!city) return null;
  for (const market of SPORTS_MARKET_CATALOG) {
    for (const alias of market.cityAliases) {
      const normalized = alias.toLowerCase();
      if (city === normalized || city.includes(normalized)) return market.id;
    }
  }
  return null;
}

function matchesHometownTeamText(
  text: string,
  sportsMarketId: string | null
): boolean {
  const market = getSportsMarketById(sportsMarketId);
  if (!market) return false;
  const hay = text.toLowerCase();
  for (const team of market.teams) {
    for (const pattern of team.patterns) {
      if (hay.includes(pattern.toLowerCase())) return true;
    }
  }
  return false;
}

export type { LocalNewsGeographicDiagnostic } from "./localNewsGeographicEligibility.ts";

export { assessLocalNewsGeographicEligibility, hasMinimumLeadSourceMaterial };

export function localNewsDeskBadge(
  contentType: LocalNewsContentType | null | undefined
): string {
  if (!contentType) return LOCAL_NEWS_CONTENT_TYPE_BADGE.local_news;
  return LOCAL_NEWS_CONTENT_TYPE_BADGE[contentType];
}

export function classifyLocalNewsContentType(
  input: {
    id?: string;
    title?: string | null;
    description?: string | null;
    source?: string | null;
    category?: string | null;
  },
  place?: {
    city?: string | null;
    state?: string | null;
    region?: string | null;
    metroKey?: string | null;
  }
): LocalNewsContentType {
  const hay = haystack(input);
  const geo = assessLocalNewsGeographicEligibility({
    id: input.id ?? input.title ?? "unknown",
    title: input.title ?? "",
    description: input.description,
    source: input.source,
    category: input.category,
    place: place ?? {},
  });

  if (!geo.eligible) {
    return "local_news";
  }

  if (geo.geographicTier === "weather" || includesAny(hay, WEATHER_HINTS)) {
    return "weather";
  }

  if (geo.geographicTier === "community" || includesAny(hay, COMMUNITY_HINTS)) {
    const sourceHay = (input.source ?? "").toLowerCase();
    if (includesAny(sourceHay, LOCAL_OUTLET_HINTS)) {
      return "local_news";
    }
    return "community";
  }

  if (geo.geographicTier === "state_sports") {
    return "sports";
  }

  return "local_news";
}

export function isEligibleLocalNewsDeskAge(
  publishedAt: string | null | undefined,
  contentType: LocalNewsContentType,
  now: Date = new Date()
): boolean {
  const hours = hoursSincePublished(publishedAt, now);
  if (hours === null) return false;
  const max =
    contentType === "local_news"
      ? LOCAL_NEWS_DESK_MAX_HOURS
      : LOCAL_NEWS_FALLBACK_MAX_HOURS;
  return hours <= max;
}

/** Press releases older than 24h may never lead the section. */
export function isPressReleaseBlockedAsLead(
  input: {
    source?: string | null;
    url?: string | null;
    publishedAt?: string | null;
  },
  now: Date = new Date()
): boolean {
  if (!isPressReleaseWire(input)) return false;
  const hours = hoursSincePublished(input.publishedAt, now);
  if (hours === null) return true;
  return hours > LOCAL_NEWS_DESK_MAX_HOURS;
}

export function buildStateSportsNewsQuery(input: {
  city?: string | null;
  state?: string | null;
  region?: string | null;
  metroKey?: string | null;
}): string | null {
  const marketId = resolveDeskSportsMarketId(input);
  const market = getSportsMarketById(marketId);
  const teams: HometownTeamDefinition[] = market
    ? market.teams.filter((t) => t.tier === "pro" || t.tier === "college")
    : [];

  const names = teams
    .slice(0, 8)
    .map((t) => t.name)
    .filter(Boolean);

  if (names.length >= 2) {
    return names.map((n) => `"${n}"`).join(" OR ");
  }

  const state = (input.state ?? input.region ?? "").trim();
  if (!state) return null;
  return `"${state}" AND (sports OR baseball OR basketball OR football OR athletics)`;
}

export function buildWeatherNewsQuery(input: {
  city?: string | null;
  state?: string | null;
  region?: string | null;
}): string | null {
  const place = [input.city, input.state ?? input.region]
    .filter((p): p is string => Boolean(p?.trim()))
    .slice(0, 2)
    .join(" ");
  if (!place) return null;
  return `${place} AND (weather OR heat OR flood OR wildfire OR storm OR "air quality")`;
}

export function buildCommunityNewsQuery(input: {
  city?: string | null;
  state?: string | null;
  region?: string | null;
}): string | null {
  const city = input.city?.trim();
  if (!city || city.toLowerCase() === "your area") return null;
  return `"${city}" AND (council OR "road closure" OR parks OR "school district" OR "public safety" OR infrastructure)`;
}

/** Phoenix metro / East Valley reporting for Gilbert readers. */
export function buildMetroNewsQuery(input: {
  city?: string | null;
  state?: string | null;
  region?: string | null;
  metroKey?: string | null;
}): string | null {
  const marketId = resolveDeskSportsMarketId(input);
  const aliases = marketId
    ? (SPORTS_MARKET_CATALOG.find((m) => m.id === marketId)?.cityAliases ?? [])
    : [];
  const tokens = Array.from(
    new Set(
      [input.city?.trim(), ...aliases.map((a) => a.trim())].filter(Boolean) as string[]
    )
  ).slice(0, 6);
  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t}"`).join(" OR ");
}

/** Arizona statewide reporting with local relevance. */
export function buildStatewideNewsQuery(input: {
  state?: string | null;
  region?: string | null;
}): string | null {
  const state = (input.state ?? input.region ?? "").trim();
  if (!state || state.length < 2) return null;
  const stateName =
    state.length === 2
      ? ({ AZ: "Arizona", CA: "California", TX: "Texas", WA: "Washington" } as Record<
          string,
          string
        >)[state.toUpperCase()] ?? state
      : state;
  return `"${stateName}" AND (government OR community OR health OR education OR public OR statewide)`;
}

export type LocalNewsDeskSelectInput<T> = {
  now?: Date;
  recentStoryKeys?: string[];
  isRecentCoverage: (candidate: T, recentKeys: string[]) => boolean;
  minScore?: number;
  place?: {
    city?: string | null;
    state?: string | null;
    region?: string | null;
    metroKey?: string | null;
  };
};

/**
 * Pick the Local News homepage lead under desk priority + freshness rules.
 * Returns null only when nothing in the priority chain qualifies.
 */
export function selectLocalNewsDeskLead<
  T extends {
    id: string;
    publishedAt?: string | null;
    source?: string | null;
    url?: string | null;
    title?: string | null;
    description?: string | null;
    category?: string | null;
    score: number;
  },
>(
  candidates: T[],
  input: LocalNewsDeskSelectInput<T>
): { candidate: T; contentType: LocalNewsContentType } | null {
  const now = input.now ?? new Date();
  const recentKeys = input.recentStoryKeys ?? [];
  const minScore = input.minScore ?? 0;

  const classified = candidates
    .filter((c) => c.score >= minScore)
    .filter((c) => !isPressReleaseBlockedAsLead(c, now))
    .map((c) => {
      const geo = assessLocalNewsGeographicEligibility({
        id: c.id,
        title: c.title ?? "",
        description: c.description,
        source: c.source,
        category: c.category,
        score: c.score,
        place: input.place ?? {},
      });
      return {
        candidate: c,
        contentType: classifyLocalNewsContentType(c, input.place),
        geo,
      };
    })
    .filter(({ geo }) => geo.eligible)
    .filter(({ candidate, contentType }) =>
      isEligibleLocalNewsDeskAge(candidate.publishedAt, contentType, now)
    )
    .filter(({ candidate }) => !input.isRecentCoverage(candidate, recentKeys));

  const rankWithin = (
    a: (typeof classified)[number],
    b: (typeof classified)[number]
  ) => {
    const tierDelta =
      geographicTierPriority(b.geo.geographicTier) -
      geographicTierPriority(a.geo.geographicTier);
    if (tierDelta !== 0) return tierDelta;
    const press =
      Number(isPressReleaseWire(a.candidate)) -
      Number(isPressReleaseWire(b.candidate));
    if (press !== 0) return press;
    if (a.contentType === "local_news" && b.contentType === "local_news") {
      const aLocal = Number(
        includesAny(haystack(a.candidate), LOCAL_OUTLET_HINTS)
      );
      const bLocal = Number(
        includesAny(haystack(b.candidate), LOCAL_OUTLET_HINTS)
      );
      if (aLocal !== bLocal) return bLocal - aLocal;
    }
    return b.candidate.score - a.candidate.score;
  };

  for (const contentType of LOCAL_NEWS_CONTENT_TYPE_PRIORITY) {
    const pool = classified
      .filter((c) => c.contentType === contentType)
      .slice()
      .sort(rankWithin);
    const pick = pool[0];
    if (pick) {
      return { candidate: pick.candidate, contentType };
    }
  }

  return null;
}

/** Compatibility wrapper — returns the candidate only. */
export function selectFreshLocalLeadCandidate<
  T extends {
    id: string;
    publishedAt?: string | null;
    source?: string | null;
    url?: string | null;
    title?: string | null;
    description?: string | null;
    category?: string | null;
    score: number;
  },
>(candidates: T[], input: LocalNewsDeskSelectInput<T>): T | null {
  return selectLocalNewsDeskLead(candidates, input)?.candidate ?? null;
}
