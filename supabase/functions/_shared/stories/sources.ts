/** Editorial quality priors — calm newspaper sources rise; clickbait falls. */
export const QUALITY_SOURCES: Record<string, number> = {
  reuters: 1,
  "associated press": 1,
  ap: 1,
  "the associated press": 1,
  bbc: 0.95,
  "bbc news": 0.95,
  "the new york times": 0.95,
  "new york times": 0.95,
  "the washington post": 0.9,
  "washington post": 0.9,
  "the wall street journal": 0.9,
  "wall street journal": 0.85,
  "financial times": 0.9,
  "the guardian": 0.85,
  npr: 0.9,
  "the atlantic": 0.85,
  "the economist": 0.9,
  bloomberg: 0.85,
  "nature": 0.9,
  "scientific american": 0.85,
  "national geographic": 0.8,
  "mit technology review": 0.85,
};

export const LOW_QUALITY_SOURCE_HINTS = [
  "daily mail",
  "buzzfeed",
  "tmz",
  "page six",
  "radar online",
  "complex.com",
  "lad bible",
  "bored panda",
  "unilad",
];

/** Syndicated press wires — deprioritize vs original local reporting. */
export const PRESS_RELEASE_SOURCE_HINTS = [
  "prnewswire",
  "globe newswire",
  "globenewswire",
  "business wire",
  "businesswire",
  "accesswire",
  "ein presswire",
];

export const BREAKING_HINTS =
  /\b(breaking|just in|developing|urgent|live updates|shoots up|collapses|emergency|evacuation)\b/i;

export const UPLIFTING_HINTS =
  /\b(discover|breakthrough|rescued|recovers|opens|celebrate|art|museum|garden|wildlife|community|kindness|solves|invention|debut)\b/i;

export const NATIONAL_HINTS =
  /\b(president|congress|white house|supreme court|nation|federal|united nations|war|ceasefire|election|senate|global|worldwide)\b/i;

export const WORLD_HINTS =
  /\b(united nations|nato|european union|middle east|ukraine|gaza|beijing|moscow|brussels|tokyo|global|worldwide|international|abroad|overseas)\b/i;

/** Map onboarding interests → NewsAPI categories + keyword cues. */
export const INTEREST_MAP: Record<
  string,
  { category: string; keywords: string[] }
> = {
  Technology: {
    category: "technology",
    keywords: [
      "tech",
      "software",
      "ai",
      "apple",
      "google",
      "microsoft",
      "chip",
      "cyber",
      "startup",
    ],
  },
  Business: {
    category: "business",
    keywords: [
      "market",
      "stocks",
      "economy",
      "bank",
      "trade",
      "company",
      "earnings",
      "inflation",
    ],
  },
  Science: {
    category: "science",
    keywords: [
      "science",
      "research",
      "space",
      "nasa",
      "physics",
      "biology",
      "study",
      "scientists",
    ],
  },
  "Health & Wellbeing": {
    category: "health",
    keywords: [
      "health",
      "medical",
      "hospital",
      "vaccine",
      "mental health",
      "wellness",
      "fda",
    ],
  },
  Sports: {
    category: "sports",
    keywords: [
      "sports",
      "nba",
      "nfl",
      "mlb",
      "soccer",
      "olympics",
      "championship",
      "match",
    ],
  },
  "Politics & Policy": {
    category: "general",
    keywords: [
      "politics",
      "policy",
      "election",
      "legislation",
      "governor",
      "mayor",
      "vote",
    ],
  },
  "Climate & Environment": {
    category: "science",
    keywords: [
      "climate",
      "environment",
      "emissions",
      "wildfire",
      "drought",
      "renewable",
      "conservation",
    ],
  },
  "Culture & Arts": {
    category: "general",
    keywords: [
      "art",
      "museum",
      "film",
      "music",
      "theater",
      "culture",
      "festival",
      "novel",
    ],
  },
};

export function interestToCategory(interest: string): string {
  return INTEREST_MAP[interest]?.category ?? "general";
}

export function primaryNewsCategory(interests: string[]): string {
  for (const interest of interests) {
    const mapped = INTEREST_MAP[interest]?.category;
    if (mapped) return mapped;
  }
  return "general";
}
