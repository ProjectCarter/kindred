/**
 * Hometown teams by sports market — reusable catalog for new metros.
 * Homepage boost and sport icons read from this data; no city-specific code paths.
 */

import type { SportEventIconKey } from "../sportEventIcon.ts";

export type HometownTeamTier = "pro" | "college" | "spring_training";

export type HometownTeamDefinition = {
  name: string;
  tier: HometownTeamTier;
  sport: SportEventIconKey;
  /** Case-insensitive phrase patterns matched in event title or venue. */
  patterns: readonly string[];
};

export type SportsMarketSpringTraining = {
  tier: "spring_training";
  /** Patterns matched in event title or venue for this market only. */
  patterns: readonly string[];
};

export type SportsMarketCatalogEntry = {
  id: string;
  label: string;
  /** Edition metro keys (city-state slugs) that belong to this sports market. */
  metroKeys: readonly string[];
  /** Normalized city aliases — suburbs and alternate spellings. */
  cityAliases: readonly string[];
  teams: readonly HometownTeamDefinition[];
  springTraining?: SportsMarketSpringTraining;
};

export const HOMETOWN_TEAM_HOMEPAGE_BOOST: Record<HometownTeamTier, number> = {
  pro: 5,
  college: 4,
  spring_training: 3,
};

export const SPORTS_MARKET_CATALOG: readonly SportsMarketCatalogEntry[] = [
  {
    id: "phoenix-metro",
    label: "Phoenix Metro",
    metroKeys: [
      "phoenix-az",
      "gilbert-az",
      "scottsdale-az",
      "mesa-az",
      "tempe-az",
      "chandler-az",
      "glendale-az",
      "peoria-az",
      "surprise-az",
      "goodyear-az",
      "avondale-az",
      "queen-creek-az",
    ],
    cityAliases: [
      "phoenix",
      "gilbert",
      "scottsdale",
      "mesa",
      "tempe",
      "chandler",
      "glendale",
      "peoria",
      "surprise",
      "goodyear",
      "avondale",
      "queen creek",
    ],
    teams: [
      {
        name: "Arizona Diamondbacks",
        tier: "pro",
        sport: "baseball",
        patterns: ["arizona diamondbacks", "diamondbacks", "d-backs", "dbacks"],
      },
      {
        name: "Phoenix Suns",
        tier: "pro",
        sport: "basketball",
        patterns: ["phoenix suns"],
      },
      {
        name: "Phoenix Mercury",
        tier: "pro",
        sport: "basketball",
        patterns: ["phoenix mercury"],
      },
      {
        name: "Phoenix Rising FC",
        tier: "pro",
        sport: "soccer",
        patterns: ["phoenix rising", "rising fc"],
      },
      {
        name: "Arizona Cardinals",
        tier: "pro",
        sport: "football",
        patterns: ["arizona cardinals"],
      },
      {
        name: "Utah Mammoth",
        tier: "pro",
        sport: "hockey",
        patterns: ["utah mammoth", "arizona coyotes"],
      },
      {
        name: "Arizona State Sun Devils",
        tier: "college",
        sport: "basketball",
        patterns: ["arizona state sun devils", "sun devils", "asu sun devils"],
      },
      {
        name: "Arizona Wildcats",
        tier: "college",
        sport: "basketball",
        patterns: ["arizona wildcats"],
      },
      {
        name: "Grand Canyon Antelopes",
        tier: "college",
        sport: "basketball",
        patterns: ["grand canyon antelopes", "gcu antelopes"],
      },
    ],
    springTraining: {
      tier: "spring_training",
      patterns: [
        "cactus league",
        "spring training",
        "scottsdale stadium",
        "camelback ranch",
        "salt river fields",
        "sloan park",
        "peoria sports complex",
        "surprise stadium",
        "goodyear ballpark",
      ],
    },
  },
  {
    id: "seattle-metro",
    label: "Seattle Metro",
    metroKeys: [
      "seattle-wa",
      "bellevue-wa",
      "tacoma-wa",
      "redmond-wa",
      "kirkland-wa",
      "everett-wa",
      "renton-wa",
    ],
    cityAliases: [
      "seattle",
      "bellevue",
      "tacoma",
      "redmond",
      "kirkland",
      "everett",
      "renton",
    ],
    teams: [
      {
        name: "Seattle Mariners",
        tier: "pro",
        sport: "baseball",
        patterns: ["seattle mariners", "mariners"],
      },
      {
        name: "Seattle Seahawks",
        tier: "pro",
        sport: "football",
        patterns: ["seattle seahawks", "seahawks"],
      },
      {
        name: "Seattle Kraken",
        tier: "pro",
        sport: "hockey",
        patterns: ["seattle kraken", "kraken"],
      },
      {
        name: "Seattle Sounders FC",
        tier: "pro",
        sport: "soccer",
        patterns: ["seattle sounders", "sounders fc"],
      },
      {
        name: "Seattle Storm",
        tier: "pro",
        sport: "basketball",
        patterns: ["seattle storm"],
      },
      {
        name: "Washington Huskies",
        tier: "college",
        sport: "football",
        patterns: ["washington huskies", "uw huskies"],
      },
    ],
  },
  {
    id: "denver-metro",
    label: "Denver Metro",
    metroKeys: [
      "denver-co",
      "aurora-co",
      "boulder-co",
      "lakewood-co",
      "fort-collins-co",
      "colorado-springs-co",
    ],
    cityAliases: ["denver", "aurora", "boulder", "lakewood", "fort collins", "colorado springs"],
    teams: [
      {
        name: "Colorado Rockies",
        tier: "pro",
        sport: "baseball",
        patterns: ["colorado rockies", "rockies"],
      },
      {
        name: "Denver Broncos",
        tier: "pro",
        sport: "football",
        patterns: ["denver broncos", "broncos"],
      },
      {
        name: "Denver Nuggets",
        tier: "pro",
        sport: "basketball",
        patterns: ["denver nuggets", "nuggets"],
      },
      {
        name: "Colorado Avalanche",
        tier: "pro",
        sport: "hockey",
        patterns: ["colorado avalanche", "avalanche"],
      },
      {
        name: "Colorado Rapids",
        tier: "pro",
        sport: "soccer",
        patterns: ["colorado rapids", "rapids"],
      },
      {
        name: "Colorado Buffaloes",
        tier: "college",
        sport: "football",
        patterns: ["colorado buffaloes", "cu buffaloes"],
      },
    ],
  },
] as const;

export type SportsMarketId = (typeof SPORTS_MARKET_CATALOG)[number]["id"];

const catalogById = new Map(
  SPORTS_MARKET_CATALOG.map((market) => [market.id, market] as const)
);

export function getSportsMarketById(
  marketId: string | null | undefined
): SportsMarketCatalogEntry | null {
  if (!marketId?.trim()) return null;
  return catalogById.get(marketId.trim() as SportsMarketId) ?? null;
}

export function listSportsMarketIds(): SportsMarketId[] {
  return SPORTS_MARKET_CATALOG.map((market) => market.id);
}
