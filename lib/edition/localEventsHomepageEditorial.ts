/**
 * Local Events homepage editorial curator — "Things to Do This Week," not a directory.
 *
 * Applies The Kindred Test and low-value exclusions before homepage ranking.
 * See All / search pools are unchanged; only homepage curation is filtered here.
 */

import type { LocalEventCard } from "./localEvents.ts";
import { isGenericEventTitle } from "./venueQuality.ts";

export type LocalEventHomepageEditorialAssessment = {
  /** May compete for homepage editorial space. */
  eligible: boolean;
  /** Diagnostic reason when excluded from homepage curation. */
  signal?: string;
  /** Ranking boost for memorable public experiences. */
  memorableBoost: number;
};

const LEGITIMATE_CULTURAL_VENUE =
  /\b(phoenix center for the arts|performing arts|museum|gallery|library|symphony|orchestra|botanical garden|science center|historic|theater|theatre|opera|civic center|arts center|community center)\b/i;

const MEMORABLE_EXPERIENCE_PATTERN =
  /\b(festival|fair|farmers?\s*market|night market|food festival|beer festival|wine tasting|concert|ghost walk|haunted history|historic tour|heritage walk|walking tour|art walk|outdoor movie|cultural celebration|parade|fiesta|exhibition|zoo|aquarium|marathon|5k|10k|symphony|orchestra|comedy show|stand-?up|improv|tour\b|\bvs\.?\b|championship|all star night|night market)\b/i;

const LOW_VALUE_HOMEPAGE_PATTERNS: Array<{ re: RegExp; signal: string }> = [
  { re: /\bregus\b/i, signal: "coworking office venue" },
  { re: /\bcoworking\b/i, signal: "coworking seminar" },
  { re: /\bideation session\b/i, signal: "business ideation session" },
  { re: /\bevent planner\b/i, signal: "professional training course" },
  { re: /\bmarketing and sales\b/i, signal: "sales training course" },
  { re: /\b1[\s-]?day\s+(course|class)\b/i, signal: "one-day business course" },
  {
    re: /\b(workshop|seminar|training|class)\b.*\b(marketing|sales|leadership|management|networking|recruiting|real estate investing|financial freedom|passive income|remote work|communication skills|event planning|business meetup|vendor pitch)\b/i,
    signal: "business workshop",
  },
  {
    re: /\b(marketing|sales|leadership|management|networking|recruiting|mlm|multi[\s-]?level marketing)\b.*\b(workshop|seminar|training|class|meetup|mixer)\b/i,
    signal: "business meetup",
  },
  { re: /\bnetworking mixer\b/i, signal: "networking mixer" },
  { re: /\bbusiness meetup\b/i, signal: "business meetup" },
  { re: /\bsales presentation\b/i, signal: "sales presentation" },
  { re: /\brecruiting event\b/i, signal: "recruiting event" },
  { re: /\bvendor pitch\b/i, signal: "vendor pitch" },
  { re: /\bmlm\b/i, signal: "MLM event" },
  { re: /\bmulti[\s-]?level marketing\b/i, signal: "MLM event" },
  { re: /\bcreative events concept\b/i, signal: "business promotion event" },
  { re: /\bestate planning\b/i, signal: "financial planning seminar" },
  { re: /\bbusiness analytics\b/i, signal: "business training course" },
  {
    re: /\b1[\s-]?day\s+training\b.*\b(strategy|analytics|business|leadership|management|communication|marketing|sales)\b/i,
    signal: "business training course",
  },
  {
    re: /\b(strategy|analytics|business|leadership|management)\b.*\b1[\s-]?day\s+training\b/i,
    signal: "business training course",
  },
  {
    re: /\b(train to inspire|inspire and influence|grow your business|lead generation)\b/i,
    signal: "promotional business seminar",
  },
];

function eventHay(event: Pick<LocalEventCard, "name" | "venue" | "city" | "category">): string {
  return [event.name, event.venue, event.city, event.category]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function atLegitimateCulturalVenue(event: Pick<LocalEventCard, "name" | "venue">): boolean {
  return LEGITIMATE_CULTURAL_VENUE.test(`${event.name} ${event.venue}`);
}

export function isPlaceholderLocalEventListing(
  event: Pick<LocalEventCard, "name" | "venue">
): boolean {
  const name = event.name.trim();
  const lowered = name.toLowerCase();
  if (!name) return true;
  if (isGenericEventTitle(name)) return true;
  if (/^(sports|sport|event|workshop|seminar|training|class|networking|meetup)$/i.test(lowered)) {
    return true;
  }
  if (/^(sports|sport|event|workshop|seminar|training|class|networking|meetup)\s+(at|in)\b/i.test(name)) {
    return true;
  }
  const hay = `${event.name} ${event.venue}`.toLowerCase();
  if (/^sports\b/i.test(lowered) && !/\b(vs\.?|match|tournament|marathon|5k|10k|championship|all star)\b/i.test(hay)) {
    return true;
  }
  if (/^golf\b/i.test(lowered) && !/\b(tournament|championship|league|vs\.?)\b/i.test(hay)) {
    return true;
  }
  if (/^live music\b/i.test(lowered) && !/\bfeaturing\b/i.test(name) && name.length < 28) {
    return true;
  }
  if (/^seasonal event\b/i.test(lowered)) return true;
  if (/\bholiday inn\b/i.test(hay) && /\bevent\b/i.test(hay)) return true;
  return false;
}

export function assessLowValueHomepageLocalEvent(
  event: Pick<LocalEventCard, "name" | "venue" | "city" | "category">
): { excluded: boolean; signal?: string } {
  const hay = eventHay(event);

  for (const { re, signal } of LOW_VALUE_HOMEPAGE_PATTERNS) {
    if (re.test(hay)) {
      if (
        atLegitimateCulturalVenue(event) &&
        /\b(drawing|painting|gallery|exhibit|theater|theatre|poetry|film screening)\b/i.test(hay)
      ) {
        continue;
      }
      return { excluded: true, signal };
    }
  }

  if (/\boffice park\b/i.test(hay) || /\bairport terminal\b/i.test(hay)) {
    return { excluded: true, signal: "low-value venue type" };
  }

  return { excluded: false };
}

function deskHint(
  event: Pick<LocalEventCard, "name" | "venue" | "category">
): "music" | "festival_fair" | "sports" | "arts_theater_comedy" | "community" | null {
  const hay = eventHay(event);
  const category = event.category;
  if (category === "music") return "music";
  if (category === "sports") return "sports";
  if (
    category === "market" ||
    category === "food" ||
    /\b(festival|fair|night market|farmers?\s*market)\b/i.test(hay)
  ) {
    return "festival_fair";
  }
  if (category === "arts" || category === "comedy") return "arts_theater_comedy";
  if (category === "community" || category === "family") return "community";
  return null;
}

export function memorableLocalEventExperienceBoost(
  event: Pick<LocalEventCard, "name" | "venue" | "city" | "category">
): number {
  const hay = eventHay(event);
  let boost = 0;

  if (MEMORABLE_EXPERIENCE_PATTERN.test(hay)) boost += 12;
  if (/\b(festival|fair|farmers?\s*market|night market)\b/i.test(hay)) boost += 6;
  if (/\bghost walk\b/i.test(hay)) boost += 8;
  if (/\b(concert|featuring|tour\b|symphony|jazz|live music)\b/i.test(hay)) boost += 6;
  if (/\b(vs\.?|game|match|tournament|marathon|5k|10k)\b/i.test(hay)) boost += 6;
  if (atLegitimateCulturalVenue(event)) boost += 4;
  if (deskHint(event) === "festival_fair") boost += 4;

  return boost;
}

/**
 * The Kindred Test — final homepage filter after verification and safety gates.
 * "If someone was visiting this city for the first time, would I genuinely
 * recommend this?"
 */
export function passesKindredTestForHomepage(
  event: LocalEventCard
): boolean {
  return assessLocalEventHomepageEditorial(event).eligible;
}

export function assessLocalEventHomepageEditorial(
  event: LocalEventCard
): LocalEventHomepageEditorialAssessment {
  const lowValue = assessLowValueHomepageLocalEvent(event);
  if (lowValue.excluded) {
    return { eligible: false, signal: lowValue.signal, memorableBoost: 0 };
  }

  if (isPlaceholderLocalEventListing(event)) {
    return { eligible: false, signal: "placeholder listing", memorableBoost: 0 };
  }

  const memorableBoost = memorableLocalEventExperienceBoost(event);
  const editorialScore =
    typeof event.editorialScore === "number" && Number.isFinite(event.editorialScore)
      ? event.editorialScore
      : 0;
  const desk = deskHint(event);

  if (memorableBoost >= 6) {
    return { eligible: true, memorableBoost };
  }

  if (editorialScore >= 28) {
    return { eligible: true, memorableBoost };
  }

  if (desk === "music" || desk === "festival_fair") {
    return { eligible: true, memorableBoost };
  }

  if (desk === "sports" && !isPlaceholderLocalEventListing(event)) {
    if (
      memorableBoost >= 6 ||
      /\b(vs\.?|match|tournament|marathon|5k|10k|championship|all star|derby|cup final)\b/i.test(
        eventHay(event)
      )
    ) {
      return { eligible: true, memorableBoost };
    }
    return { eligible: false, signal: "generic sports listing", memorableBoost };
  }

  if (
    (desk === "arts_theater_comedy" || desk === "community") &&
    atLegitimateCulturalVenue(event)
  ) {
    return { eligible: true, memorableBoost };
  }

  if (desk === "community" && memorableBoost >= 4) {
    return { eligible: true, memorableBoost };
  }

  return {
    eligible: false,
    signal: "kindred test — not a first-visit recommendation",
    memorableBoost,
  };
}

/** Homepage-only pool — See All keeps the full verified edition list. */
export function filterLocalEventsForHomepageCuration(
  events: readonly LocalEventCard[]
): LocalEventCard[] {
  return events.filter((event) => passesKindredTestForHomepage(event));
}
