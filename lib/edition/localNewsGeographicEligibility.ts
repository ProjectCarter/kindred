/**
 * Local News geographic eligibility — wire candidates must belong to the reader's
 * city, metro, state, or (fallback) in-state professional sports.
 */

import { normalizeCityKey } from "../location/locationKey.ts";
import {
  getSportsMarketById,
  SPORTS_MARKET_CATALOG,
  type HometownTeamDefinition,
} from "./hometownTeams/catalog.ts";
import { wordCount } from "./localNewsSourceQuality.ts";

export type LocalNewsReaderPlace = {
  city?: string | null;
  region?: string | null;
  state?: string | null;
  metroKey?: string | null;
};

export type DetectedTeam = {
  name: string;
  tier: HometownTeamDefinition["tier"];
  homeState: string | null;
  isHometown: boolean;
};

export type LocalNewsGeographicTier =
  | "city"
  | "metro"
  | "state"
  | "state_sports"
  | "weather"
  | "community"
  | "rejected";

export type LocalNewsGeographicDiagnostic = {
  storyId: string;
  title: string;
  candidateCity: string | null;
  candidateMetro: string | null;
  candidateState: string | null;
  detectedTeams: DetectedTeam[];
  userCity: string | null;
  userMetro: string | null;
  userState: string | null;
  geographicTier: LocalNewsGeographicTier;
  eligible: boolean;
  eligibilityReason: string;
  rejectionReason: string | null;
  finalScore: number | null;
};

const US_STATE_NAMES: Record<string, string> = {
  AL: "alabama",
  AZ: "arizona",
  CA: "california",
  CO: "colorado",
  TX: "texas",
  WA: "washington",
  NV: "nevada",
  UT: "utah",
  NM: "new mexico",
};

/** Major out-of-market pro franchises — never Local News primary subject outside home state. */
const OUT_OF_STATE_PRO_TEAMS: Array<{ patterns: string[]; state: string; label: string }> = [
  { patterns: ["los angeles dodgers", " la dodgers", "dodgers change", "dodgers sign", "dodgers trade"], state: "CA", label: "Los Angeles Dodgers" },
  { patterns: ["tampa bay rays", " tb rays", "rays drop", "rays lose", "rays beat"], state: "FL", label: "Tampa Bay Rays" },
  { patterns: ["boston red sox", " red sox"], state: "MA", label: "Boston Red Sox" },
  { patterns: ["houston rockets", "rockets sign", "rockets trade", "rockets waive"], state: "TX", label: "Houston Rockets" },
  { patterns: ["san francisco giants", "sf giants"], state: "CA", label: "San Francisco Giants" },
  { patterns: ["los angeles lakers", " la lakers"], state: "CA", label: "Los Angeles Lakers" },
  { patterns: ["golden state warriors", "gsw "], state: "CA", label: "Golden State Warriors" },
  { patterns: ["san diego padres"], state: "CA", label: "San Diego Padres" },
  { patterns: ["dallas cowboys", "dallas mavericks", "dallas stars"], state: "TX", label: "Dallas team" },
  { patterns: ["seattle mariners", "seattle seahawks", "seattle kraken"], state: "WA", label: "Seattle team" },
];

const METRO_CITY_ALIASES: Record<string, readonly string[]> = Object.fromEntries(
  SPORTS_MARKET_CATALOG.map((market) => [market.id, market.cityAliases])
);

function normalizeHay(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function resolveSportsMarketId(place: LocalNewsReaderPlace): string | null {
  const metro = place.metroKey?.trim();
  if (metro) {
    for (const market of SPORTS_MARKET_CATALOG) {
      if ((market.metroKeys as readonly string[]).includes(metro)) return market.id;
    }
  }
  const city = normalizeHay(place.city ?? "");
  if (!city) return null;
  for (const market of SPORTS_MARKET_CATALOG) {
    for (const alias of market.cityAliases) {
      const normalized = alias.toLowerCase();
      if (city === normalized || city.includes(normalized)) return market.id;
    }
  }
  return null;
}

function userStateCode(place: LocalNewsReaderPlace): string | null {
  const raw = (place.state ?? place.region ?? "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(raw)) return raw;
  for (const [code, name] of Object.entries(US_STATE_NAMES)) {
    if (raw.toLowerCase() === name) return code;
  }
  return null;
}

function detectTeams(text: string, hometownMarketId: string | null, userState: string | null): DetectedTeam[] {
  const hay = normalizeHay(text);
  const found: DetectedTeam[] = [];
  const market = getSportsMarketById(hometownMarketId);
  if (market) {
    for (const team of market.teams) {
      for (const pattern of team.patterns) {
        if (hay.includes(pattern.toLowerCase())) {
          found.push({
            name: team.name,
            tier: team.tier,
            homeState: userState,
            isHometown: true,
          });
          break;
        }
      }
    }
  }
  for (const team of OUT_OF_STATE_PRO_TEAMS) {
    if (team.patterns.some((p) => hay.includes(p))) {
      found.push({
        name: team.label,
        tier: "pro",
        homeState: team.state,
        isHometown: false,
      });
    }
  }
  return found;
}

function foreignStatePattern(ownState: string): RegExp | null {
  const own = ownState.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(own)) return null;
  const patterns: string[] = [];
  for (const [code, name] of Object.entries(US_STATE_NAMES)) {
    if (code === own) continue;
    patterns.push(`\\b${name}\\b`, `\\b${code}\\b`);
  }
  return patterns.length ? new RegExp(patterns.join("|"), "i") : null;
}

function headlinePrimarySubjectIsOutOfStateTeam(
  headline: string,
  detectedTeams: DetectedTeam[],
  userState: string | null
): DetectedTeam | null {
  const hay = normalizeHay(headline);
  for (const team of detectedTeams) {
    if (team.isHometown || !team.homeState || team.homeState === userState) continue;
    const patterns =
      OUT_OF_STATE_PRO_TEAMS.find((t) => t.label === team.name)?.patterns ?? [];
    if (patterns.some((p) => hay.includes(p.trim()))) return team;
    if (hay.startsWith(team.name.toLowerCase().split(" ").slice(-1)[0] ?? "")) return team;
  }
  for (const team of OUT_OF_STATE_PRO_TEAMS) {
    if (team.state === userState) continue;
    if (team.patterns.some((p) => hay.includes(p.trim()))) return {
      name: team.label,
      tier: "pro",
      homeState: team.state,
      isHometown: false,
    };
  }
  return null;
}

function includesPlace(hay: string, place: string | null | undefined): boolean {
  const token = normalizeHay(place ?? "");
  return token.length >= 3 && hay.includes(token);
}

function includesState(hay: string, stateCode: string | null | undefined): boolean {
  const code = (stateCode ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return includesPlace(hay, stateCode);
  const fullName = US_STATE_NAMES[code];
  if (fullName && hay.includes(fullName)) return true;
  return new RegExp(`\\b${code.toLowerCase()}\\b`).test(hay);
}

function headlineMentionsHometownTeam(
  headlineHay: string,
  sportsMarketId: string | null
): boolean {
  const market = getSportsMarketById(sportsMarketId);
  if (!market) return false;
  for (const team of market.teams) {
    for (const pattern of team.patterns) {
      if (headlineHay.includes(pattern.toLowerCase())) return true;
    }
  }
  return false;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function includesMetroCity(
  hay: string,
  sportsMarketId: string | null,
  userCity?: string | null
): boolean {
  if (!sportsMarketId) return false;
  const aliases = METRO_CITY_ALIASES[sportsMarketId] ?? [];
  const normalizedUserCity = normalizeHay(userCity ?? "");
  return aliases.some((alias) => {
    const token = alias.toLowerCase().trim();
    if (!token) return false;
    if (normalizedUserCity && token === normalizedUserCity) {
      return new RegExp(`\\b${escapeRegExp(token)}\\b`).test(hay);
    }
    return (
      new RegExp(`\\b(in|near|across|throughout)\\s+${escapeRegExp(token)}\\b`).test(
        hay
      ) ||
      new RegExp(`\\b${escapeRegExp(token)},\\s*(az|arizona)\\b`).test(hay) ||
      new RegExp(`\\b${escapeRegExp(token)}\\s+(area|metro|region|valley)\\b`).test(
        hay
      ) ||
      (token.length >= 6 &&
        new RegExp(`\\b${escapeRegExp(token)}\\b`).test(hay) &&
        /\barizona\b|\baz\b|metro|valley|county|city council|mayor/.test(hay))
    );
  });
}

export function assessLocalNewsGeographicEligibility(input: {
  id: string;
  title: string;
  description?: string | null;
  source?: string | null;
  category?: string | null;
  score?: number | null;
  place: LocalNewsReaderPlace;
}): LocalNewsGeographicDiagnostic {
  const hay = normalizeHay(`${input.title} ${input.description ?? ""} ${input.source ?? ""}`);
  const headlineHay = normalizeHay(input.title);
  const sportsMarketId = resolveSportsMarketId(input.place);
  const userState = userStateCode(input.place);
  const userCity = input.place.city?.trim() || null;
  const userMetro = input.place.metroKey?.trim() || sportsMarketId;
  const detectedTeams = detectTeams(hay, sportsMarketId, userState);

  const outOfStatePrimary = headlinePrimarySubjectIsOutOfStateTeam(
    input.title,
    detectedTeams,
    userState
  );
  if (outOfStatePrimary) {
    return {
      storyId: input.id,
      title: input.title,
      candidateCity: null,
      candidateMetro: null,
      candidateState: outOfStatePrimary.homeState,
      detectedTeams,
      userCity,
      userMetro,
      userState,
      geographicTier: "rejected",
      eligible: false,
      eligibilityReason: "primary_subject_out_of_state_team",
      rejectionReason: `Primary subject is out-of-state team (${outOfStatePrimary.name})`,
      finalScore: input.score ?? null,
    };
  }

  if (userState) {
    const foreign = foreignStatePattern(userState);
    if (foreign?.test(hay)) {
      const hasHometown = detectedTeams.some((t) => t.isHometown);
      const cityHit = includesPlace(hay, userCity) || includesMetroCity(hay, sportsMarketId, userCity);
      if (!hasHometown && !cityHit) {
        return {
          storyId: input.id,
          title: input.title,
          candidateCity: null,
          candidateMetro: null,
          candidateState: null,
          detectedTeams,
          userCity,
          userMetro,
          userState,
          geographicTier: "rejected",
          eligible: false,
          eligibilityReason: "foreign_state_without_local_anchor",
          rejectionReason: `Mentions another state without local anchor for ${userState}`,
          finalScore: input.score ?? null,
        };
      }
    }
  }

  if (includesPlace(hay, userCity)) {
    return {
      storyId: input.id,
      title: input.title,
      candidateCity: userCity,
      candidateMetro: userMetro,
      candidateState: userState,
      detectedTeams,
      userCity,
      userMetro,
      userState,
      geographicTier: "city",
      eligible: true,
      eligibilityReason: "city_match",
      rejectionReason: null,
      finalScore: input.score ?? null,
    };
  }

  const hometownTeam = detectedTeams.find((t) => t.isHometown);
  if (
    hometownTeam &&
    (headlineHay.includes(hometownTeam.name.toLowerCase()) ||
      headlineMentionsHometownTeam(headlineHay, sportsMarketId))
  ) {
    return {
      storyId: input.id,
      title: input.title,
      candidateCity: null,
      candidateMetro: userMetro,
      candidateState: userState,
      detectedTeams,
      userCity,
      userMetro,
      userState,
      geographicTier: "state_sports",
      eligible: true,
      eligibilityReason: "in_state_hometown_team_primary",
      rejectionReason: null,
      finalScore: input.score ?? null,
    };
  }

  if (includesMetroCity(hay, sportsMarketId, userCity)) {
    return {
      storyId: input.id,
      title: input.title,
      candidateCity: null,
      candidateMetro: userMetro,
      candidateState: userState,
      detectedTeams,
      userCity,
      userMetro,
      userState,
      geographicTier: "metro",
      eligible: true,
      eligibilityReason: "metro_match",
      rejectionReason: null,
      finalScore: input.score ?? null,
    };
  }

  if (userState && includesState(hay, userState)) {
    return {
      storyId: input.id,
      title: input.title,
      candidateCity: null,
      candidateMetro: userMetro,
      candidateState: userState,
      detectedTeams,
      userCity,
      userMetro,
      userState,
      geographicTier: "state",
      eligible: true,
      eligibilityReason: "state_match",
      rejectionReason: null,
      finalScore: input.score ?? null,
    };
  }

  if (/\b(weather warning|heat advisory|flood warning|wildfire|monsoon|air quality|nws)\b/i.test(hay)) {
    return {
      storyId: input.id,
      title: input.title,
      candidateCity: userCity,
      candidateMetro: userMetro,
      candidateState: userState,
      detectedTeams,
      userCity,
      userMetro,
      userState,
      geographicTier: "weather",
      eligible: true,
      eligibilityReason: "weather_desk",
      rejectionReason: null,
      finalScore: input.score ?? null,
    };
  }

  if (/\b(city council|school district|road closure|public meeting|zoning)\b/i.test(hay)) {
    return {
      storyId: input.id,
      title: input.title,
      candidateCity: userCity,
      candidateMetro: userMetro,
      candidateState: userState,
      detectedTeams,
      userCity,
      userMetro,
      userState,
      geographicTier: "community",
      eligible: true,
      eligibilityReason: "community_desk",
      rejectionReason: null,
      finalScore: input.score ?? null,
    };
  }

  return {
    storyId: input.id,
    title: input.title,
    candidateCity: null,
    candidateMetro: null,
    candidateState: null,
    detectedTeams,
    userCity,
    userMetro,
    userState,
    geographicTier: "rejected",
    eligible: false,
    eligibilityReason: "no_local_geographic_anchor",
    rejectionReason: "No city, metro, state, or in-state sports anchor",
    finalScore: input.score ?? null,
  };
}

export function geographicTierPriority(tier: LocalNewsGeographicTier): number {
  switch (tier) {
    case "city":
      return 7;
    case "metro":
      return 6;
    case "state":
      return 5;
    case "state_sports":
      return 4;
    case "weather":
      return 3;
    case "community":
      return 2;
    default:
      return 0;
  }
}

/** Verified fallback order for Local News desk selection. */
export const LOCAL_NEWS_GEO_FALLBACK_ORDER: LocalNewsGeographicTier[] = [
  "city",
  "metro",
  "state",
  "state_sports",
  "weather",
  "community",
];

export function hasMinimumLeadSourceMaterial(input: {
  title: string;
  description?: string | null;
}): boolean {
  const description = input.description?.trim() ?? "";
  const title = input.title?.trim() ?? "";
  if (!description || description.toLowerCase() === title.toLowerCase()) return false;
  const sentences = description.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  if (wordCount(description) < 20) return false;
  if (sentences.length < 2) return false;
  return true;
}

/** Shorter factual wire — one distinct paragraph, no invention. */
export function hasAcceptableFallbackSourceMaterial(input: {
  title: string;
  description?: string | null;
}): boolean {
  const description = input.description?.trim() ?? "";
  const title = input.title?.trim() ?? "";
  if (!description || description.toLowerCase() === title.toLowerCase()) return false;
  if (wordCount(description) < 12) return false;
  const normalizedTitle = normalizeHay(title);
  const normalizedBody = normalizeHay(description);
  if (normalizedBody.includes(normalizedTitle) && wordCount(description) < 18) {
    return false;
  }
  return true;
}
