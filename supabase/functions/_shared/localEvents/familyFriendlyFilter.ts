/**
 * Editorial exclusion filter — Kindred is a premium, family-friendly morning
 * newspaper. Listings that fail this gate never enter gather → dedupe → rank.
 *
 * Shared by Local Events, Activities, Recommendations, Bandit's Pick, and any
 * future discovery surface. Provider-agnostic: Eventbrite, Ticketmaster, etc.
 */

import type { LocalEvent } from "./provider.ts";

export type EditorialExclusionCategory =
  | "adult_entertainment"
  | "hate_extremism"
  | "violence_illegal"
  | "scam_fraud";

export type FamilyFriendlyFilterAssessment = {
  excluded: boolean;
  /** Human-readable match for edition diagnostics. */
  signal?: string;
  category?: EditorialExclusionCategory;
};

export type FamilyFriendlyFilterResult = {
  kept: LocalEvent[];
  filteredCount: number;
  /** Up to 8 samples for build logs — diagnostics only, never reader-facing. */
  samples: Array<{
    name: string;
    signal: string;
    category: EditorialExclusionCategory;
  }>;
};

/** Legitimate performance and cultural venues — safe harbor for theatre, music, dance. */
const LEGITIMATE_PERFORMANCE_VENUE =
  /\b(broadway|theatre|theater|opera house|performing arts|arts center|dance company|ballet|philharmonic|symphony hall|civic center|amphitheater|amphitheatre|concert hall|auditorium|opera\b|symphony\b)\b/i;

/** Educational, cultural, and community venues — safe harbor for seminars and charity. */
const LEGITIMATE_EDITORIAL_VENUE =
  /\b(museum|gallery|library|university|college|school|community center|ymca|youth center|town hall|farmers market|festival|charity|nonprofit|performing arts|arts center|stadium|arena|ballpark|botanical garden|historic)\b/i;

const ADULT_VENUE_PATTERN =
  /\b(strip club|stripclub|gentlemen'?s club|gentlemens club|adult club|adult nightclub|adult bookstore|adult arcade|cabaret lounge|sex shop|adult video)\b/i;

const ADULT_EXCLUSION_PATTERNS: Array<{ re: RegExp; signal: string }> = [
  { re: /\bstrip\s*club\b/i, signal: "strip club" },
  { re: /\bstripclub\b/i, signal: "stripclub" },
  { re: /\bgentlemen'?s\s+club\b/i, signal: "gentlemen's club" },
  { re: /\bgentlemens\s+club\b/i, signal: "gentlemen's club" },
  { re: /\bexotic\s+dancers?\b/i, signal: "exotic dancers" },
  { re: /\badult\s+entertainment\b/i, signal: "adult entertainment" },
  { re: /\badult\s+bookstore\b/i, signal: "adult bookstore" },
  { re: /\badult\s+arcade\b/i, signal: "adult arcade" },
  { re: /\bmale\s+strippers?\b/i, signal: "male strippers" },
  { re: /\bfemale\s+strippers?\b/i, signal: "female strippers" },
  { re: /\bstrippers?\s+revue\b/i, signal: "stripper revue" },
  { re: /\bmale\s+strippers?\s+revue\b/i, signal: "male stripper revue" },
  { re: /\bmale\s+revue\b/i, signal: "male revue" },
  { re: /\bfemale\s+revue\b/i, signal: "female revue" },
  { re: /\bbuffboyzz\b/i, signal: "BuffBoyzz" },
  { re: /\bmuscle\s+men\b/i, signal: "muscle men revue" },
  { re: /\blap\s+dance\b/i, signal: "lap dance" },
  { re: /\bfull\s+nud(e|ity)\b/i, signal: "full nudity" },
  { re: /\btopless\s+(bar|club|revue|show|entertainment)\b/i, signal: "topless adult venue" },
  { re: /\bescort\s+(service|event|party|agency)\b/i, signal: "escort service" },
  { re: /\bescorts?\s+only\b/i, signal: "escorts only" },
  { re: /\bswingers?\b/i, signal: "swinger event" },
  { re: /\bswinger\s+(party|event|club)\b/i, signal: "swinger event" },
  { re: /\bbdsm\b/i, signal: "BDSM event" },
  { re: /\bfetish\s+(party|event|ball|convention|expo)\b/i, signal: "fetish event" },
  { re: /\bsex\s+expo\b/i, signal: "sex expo" },
  { re: /\bpornograph/i, signal: "pornography" },
  { re: /\bxxx\b/i, signal: "xxx" },
  { re: /\badult\s+film\b/i, signal: "adult film" },
  { re: /\badult\s+expo\b/i, signal: "adult expo" },
  { re: /\badult[\s-]+only\s+(entertainment|show|revue|night)\b/i, signal: "adult-only entertainment" },
  { re: /\b21\+\s*(only|entertainment|revue|show)\b/i, signal: "21+ adult show" },
  { re: /\badult\s+cabaret\b/i, signal: "adult cabaret" },
  { re: /\berotic\s+dance\b/i, signal: "erotic dance" },
  { re: /\bpeep\s+show\b/i, signal: "peep show" },
  { re: /\bgo[\s-]?go\s+(bar|dancer)/i, signal: "go-go bar" },
  { re: /\bsexually\s+explicit\b/i, signal: "sexually explicit performance" },
];

const HATE_EXTREMISM_PATTERNS: Array<{ re: RegExp; signal: string }> = [
  { re: /\bwhite\s+supremac/i, signal: "white supremacist event" },
  { re: /\bneo[\s-]?nazi\b/i, signal: "neo-nazi event" },
  { re: /\bku\s+klux\s+klan\b/i, signal: "hate group event" },
  { re: /\bkkk\s+rally\b/i, signal: "hate group rally" },
  { re: /\bhate\s+group\b/i, signal: "hate group event" },
  { re: /\bextremist\s+(rally|march|gathering|organization)\b/i, signal: "extremist organization" },
  { re: /\baryan\s+nation\b/i, signal: "extremist organization" },
  { re: /\b(proud\s+boys|oath\s+keepers)\s+(rally|march|meetup|gathering)\b/i, signal: "extremist rally" },
];

const VIOLENCE_ILLEGAL_PATTERNS: Array<{ re: RegExp; signal: string }> = [
  { re: /\briot\s+training\b/i, signal: "violence promotion" },
  { re: /\binsurrection\s+(training|rally|meetup)\b/i, signal: "illegal activity promotion" },
  { re: /\billegal\s+(weapons?|drug|activity)\s+(sale|traffick|workshop)\b/i, signal: "illegal activity promotion" },
  { re: /\b(unlicensed|underground)\s+fight\s+night\b/i, signal: "illegal fighting event" },
  { re: /\bhuman\s+traffick/i, signal: "illegal activity" },
];

const SCAM_FRAUD_PATTERNS: Array<{ re: RegExp; signal: string }> = [
  { re: /\bpyramid\s+scheme\b/i, signal: "pyramid scheme" },
  { re: /\bmlm\s+(recruiting|opportunity|seminar|meeting)\b/i, signal: "MLM recruiting event" },
  { re: /\bmulti[\s-]?level\s+marketing\s+(opportunity|recruiting|seminar)\b/i, signal: "MLM recruiting event" },
  { re: /\b(network\s+marketing|direct\s+sales)\s+opportunity\b/i, signal: "MLM recruiting event" },
  { re: /\btimeshare\s+(sales|presentation|seminar|pitch|workshop)\b/i, signal: "timeshare sales presentation" },
  { re: /\bget\s+rich\s+quick\b/i, signal: "get rich quick seminar" },
  { re: /\b(passive\s+income\s+secret|financial\s+freedom\s+seminar|wealth\s+building\s+secrets)\b/i, signal: "predatory financial seminar" },
  { re: /\b(crypto\s+scam|fake\s+investment|rug\s+pull|pump\s+and\s+dump)\b/i, signal: "fake investment scam" },
  { re: /\b(guaranteed\s+returns|double\s+your\s+money|no[\s-]?risk\s+investment)\s+seminar\b/i, signal: "predatory financial seminar" },
  { re: /\b(debt\s+relief\s+scam|foreclosure\s+rescue\s+scam|predatory\s+lending\s+seminar)\b/i, signal: "predatory financial seminar" },
  { re: /\bfree\s+(steak\s+dinner|vacation|gift)\s+—?\s*(timeshare|presentation|seminar)\b/i, signal: "timeshare sales presentation" },
  {
    re: /\b(leadership|management|team|remote work|communication)\s+(skills|essentials|success).{0,48}\b(workshop|seminar|training|class)\b/i,
    signal: "predatory professional seminar",
  },
  {
    re: /\b1[\s-]?day\s+(workshop|training|seminar|class)\b.*\b(leadership|management|team|remote work|communication|crisis)\b/i,
    signal: "predatory professional seminar",
  },
  { re: /\b(startup networking|networking night for startups)\b/i, signal: "networking spam event" },
];

export type FamilyFriendlyListingInput = {
  name: string;
  venue?: string | null;
  category?: string | null;
  description?: string | null;
  tags?: string[];
  organizer?: string | null;
  sourceUrl?: string | null;
};

function listingHay(input: FamilyFriendlyListingInput): string {
  return [
    input.name,
    input.venue,
    input.category,
    input.description,
    input.organizer,
    input.sourceUrl,
    ...(input.tags ?? []),
  ]
    .filter((part) => typeof part === "string" && part.trim())
    .join(" ")
    .toLowerCase();
}

function atLegitimatePerformanceVenue(hay: string): boolean {
  return LEGITIMATE_PERFORMANCE_VENUE.test(hay);
}

function atLegitimateEditorialVenue(hay: string): boolean {
  return LEGITIMATE_EDITORIAL_VENUE.test(hay) || atLegitimatePerformanceVenue(hay);
}

function isEducationalOrCharityContext(hay: string): boolean {
  return (
    /\b(charity|fundraiser|benefit for|educational|lecture|workshop|literacy|museum exhibit|panel discussion|community seminar)\b/i.test(
      hay
    ) && atLegitimateEditorialVenue(hay)
  );
}

function matchPatterns(
  hay: string,
  patterns: Array<{ re: RegExp; signal: string }>
): string | null {
  for (const { re, signal } of patterns) {
    if (re.test(hay)) return signal;
  }
  return null;
}

function assessAdultEntertainment(
  hay: string,
  title: string,
  tagHay: string
): FamilyFriendlyFilterAssessment | null {
  if (ADULT_VENUE_PATTERN.test(hay)) {
    return {
      excluded: true,
      signal: "adult venue category",
      category: "adult_entertainment",
    };
  }

  const adultMatch = matchPatterns(hay, ADULT_EXCLUSION_PATTERNS);
  if (adultMatch) {
    return {
      excluded: true,
      signal: adultMatch,
      category: "adult_entertainment",
    };
  }

  if (/\bburlesque\b/i.test(hay)) {
    const adultBurlesque =
      /\b(strip|gentlemen|adult|xxx|topless|nude|erotic|sexually explicit|cabaret\s+night)\b/i.test(
        hay
      );
    if (adultBurlesque || !atLegitimatePerformanceVenue(hay)) {
      return {
        excluded: true,
        signal: "explicit or adult-oriented burlesque",
        category: "adult_entertainment",
      };
    }
  }

  if (/\bdrag\b/i.test(hay)) {
    if (
      /\b(story hour|storytime|library|children'?s|kids|family story)\b/i.test(hay) &&
      /\b(library|public library|bookstore)\b/i.test(hay)
    ) {
      return null;
    }
    return {
      excluded: true,
      signal: "drag show",
      category: "adult_entertainment",
    };
  }

  if (
    /\b(adult dating|singles hookup|hookup party|sugar daddy|sugar baby|christian singles|singles bonfire|speed dating)\b/i.test(
      hay
    )
  ) {
    return {
      excluded: true,
      signal: "adult dating event",
      category: "adult_entertainment",
    };
  }

  if (
    /\b(adult only|adults only|adult entertainment|erotic|xxx)\b/i.test(tagHay) &&
    !atLegitimatePerformanceVenue(hay)
  ) {
    return {
      excluded: true,
      signal: "adult provider tag",
      category: "adult_entertainment",
    };
  }

  if (
    /\b(revue|stripper|striptease)\b/i.test(title) &&
    !atLegitimatePerformanceVenue(hay) &&
    !/\b(broadway|ballet|comedy|theatre|theater|opera|symphony)\b/i.test(hay)
  ) {
    return {
      excluded: true,
      signal: "revue or stripper show",
      category: "adult_entertainment",
    };
  }

  return null;
}

function assessHateExtremism(hay: string): FamilyFriendlyFilterAssessment | null {
  const match = matchPatterns(hay, HATE_EXTREMISM_PATTERNS);
  if (!match) return null;

  if (
    isEducationalOrCharityContext(hay) &&
    /\b(exhibit|lecture|discussion|educational|history|against hate|anti[\s-]?hate)\b/i.test(
      hay
    )
  ) {
    return null;
  }

  return {
    excluded: true,
    signal: match,
    category: "hate_extremism",
  };
}

function assessViolenceIllegal(hay: string): FamilyFriendlyFilterAssessment | null {
  const match = matchPatterns(hay, VIOLENCE_ILLEGAL_PATTERNS);
  if (!match) return null;

  return {
    excluded: true,
    signal: match,
    category: "violence_illegal",
  };
}

function assessScamFraud(hay: string): FamilyFriendlyFilterAssessment | null {
  const match = matchPatterns(hay, SCAM_FRAUD_PATTERNS);
  if (!match) return null;

  if (isEducationalOrCharityContext(hay)) return null;
  if (/\b(charity gala|fundraiser|5k for|benefit for|nonprofit)\b/i.test(hay)) {
    return null;
  }

  return {
    excluded: true,
    signal: match,
    category: "scam_fraud",
  };
}

/**
 * Permanent exclusion gate — shared by Local Events and discovery surfaces.
 */
export function assessFamilyFriendlyListing(
  input: FamilyFriendlyListingInput
): FamilyFriendlyFilterAssessment {
  const hay = listingHay(input);
  const title = input.name.toLowerCase();
  const tagHay = (input.tags ?? []).join(" ").toLowerCase();

  return (
    assessAdultEntertainment(hay, title, tagHay) ??
    assessHateExtremism(hay) ??
    assessViolenceIllegal(hay) ??
    assessScamFraud(hay) ?? { excluded: false }
  );
}

export function buildEventFamilyFriendlyInput(
  event: LocalEvent
): FamilyFriendlyListingInput {
  const signals = event.badgeSignals;
  const providerTags = signals?.providerTags ?? [];
  return {
    name: event.name,
    venue: event.venue,
    category: event.category ?? signals?.eventCategory ?? null,
    description: signals?.description ?? null,
    tags: providerTags,
    organizer: event.sourceName,
    sourceUrl: event.sourceUrl,
  };
}

export function isFamilyFriendlyEvent(event: LocalEvent): boolean {
  return !assessFamilyFriendlyListing(buildEventFamilyFriendlyInput(event))
    .excluded;
}

export function filterFamilyFriendlyEvents(
  events: LocalEvent[]
): FamilyFriendlyFilterResult {
  const kept: LocalEvent[] = [];
  const samples: FamilyFriendlyFilterResult["samples"] = [];

  for (const event of events) {
    const assessment = assessFamilyFriendlyListing(
      buildEventFamilyFriendlyInput(event)
    );
    if (assessment.excluded) {
      if (samples.length < 8) {
        samples.push({
          name: event.name.slice(0, 80),
          signal: assessment.signal ?? "editorial exclusion",
          category: assessment.category ?? "adult_entertainment",
        });
      }
      continue;
    }
    kept.push(event);
  }

  return {
    kept,
    filteredCount: events.length - kept.length,
    samples,
  };
}

/** Haystack helper for discovery items, venues, and Bandit candidates. */
export function isEditoriallyExcludedListing(
  hay: string
): FamilyFriendlyFilterAssessment {
  return assessFamilyFriendlyListing({ name: hay });
}

/** @deprecated Use isEditoriallyExcludedListing — kept for existing imports. */
export function isAdultEntertainmentListing(
  hay: string
): FamilyFriendlyFilterAssessment {
  return isEditoriallyExcludedListing(hay);
}
