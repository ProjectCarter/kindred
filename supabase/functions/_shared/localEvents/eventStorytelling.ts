/**
 * Event storytelling — server mirror of lib/edition/eventStorytelling.ts
 * Keep classification, golden test, and guidance in sync with the client module.
 */

import {
  extractLastParagraph,
  passesUniqueConclusionTest,
} from "../editorial/uniqueConclusions.ts";
import { passesLastingThoughtTest } from "../editorial/memorableWriting.ts";

import type { LocalEvent } from "./provider.ts";

export type EventStoryType =
  | "concert"
  | "festival"
  | "farmers_market"
  | "art_exhibition"
  | "museum_event"
  | "theater"
  | "author_talk"
  | "community_gathering"
  | "outdoor_recreation"
  | "food_drink"
  | "workshop_class"
  | "sports"
  | "family_event"
  | "seasonal_event"
  | "general";

const STOP_WORDS = new Set([
  "the", "a", "an", "at", "in", "on", "of", "and", "with", "for", "to", "from",
  "live", "night", "day", "event", "events", "annual", "local", "free",
]);

export const STORY_TYPE_LABEL: Record<EventStoryType, string> = {
  concert: "Concert",
  festival: "Festival",
  farmers_market: "Farmers Market",
  art_exhibition: "Art Exhibition",
  museum_event: "Museum Event",
  theater: "Theater Performance",
  author_talk: "Author Talk",
  community_gathering: "Community Gathering",
  outdoor_recreation: "Outdoor Recreation",
  food_drink: "Food & Drink",
  workshop_class: "Workshop / Class",
  sports: "Sports",
  family_event: "Family Event",
  seasonal_event: "Seasonal Event",
  general: "Community Event",
};

export const STORY_TYPE_GUIDANCE: Record<EventStoryType, string> = {
  concert:
    "Lead with the music, room, or artist — sound and setting first, not logistics.",
  festival:
    "Lead with what fills the day — stalls, performances, food, the crowd, the setting.",
  farmers_market:
    "Lead with what's in season and the rhythm of the market — vendors, produce, morning energy.",
  art_exhibition:
    "Lead with what visitors will see — medium, artist, gallery, or opening focus.",
  museum_event:
    "Lead with the program — talk, tour, exhibit, or collection hook at the museum.",
  theater:
    "Lead with the production — play, company, stage, or performance experience.",
  author_talk:
    "Lead with the author, book, or conversation — why readers would sit in for this talk.",
  community_gathering:
    "Lead with who gathers and why — neighborhood, cause, or shared activity.",
  outdoor_recreation:
    "Lead with the activity and setting — trail, park, water, or open-air format.",
  food_drink:
    "Lead with what's being served or tasted — menu, chef, brewery, or dining format.",
  workshop_class:
    "Lead with what participants will do or make — skill, instructor, hands-on format.",
  sports:
    "Lead with the match, race, or competition — team, course, or spectator experience.",
  family_event:
    "Lead with what kids or families will do together — activity, pace, and setting.",
  seasonal_event:
    "Lead with the season or occasion — holiday, summer, harvest, or limited window.",
  general:
    "Lead with the specific experience at this venue — never a generic calendar line.",
};

export function classifyEventStoryType(event: Pick<LocalEvent, "name" | "venue" | "category">): EventStoryType {
  const hay = `${event.name} ${event.venue}`.toLowerCase();

  if (/farmers?\s*market|farm\s*market|produce market/.test(hay)) return "farmers_market";
  if (/festival|fair\b|carnival|parade|street fair/.test(hay)) return "festival";
  if (/concert|live music|symphony|orchestra|\bdj\b|jazz night|open mic/.test(hay)) {
    return "concert";
  }
  if (/author|book signing|book talk|poetry reading|literary/.test(hay)) return "author_talk";
  if (/exhibit|exhibition|gallery opening|art walk/.test(hay)) return "art_exhibition";
  if (/museum|curator|collection tour/.test(hay)) return "museum_event";
  if (/theater|theatre|play\b|musical|ballet|opera|improv|comedy show|stand-?up/.test(hay)) {
    return "theater";
  }
  if (/workshop|class\b|lesson|course|studio session|watercolor|pottery|cooking class/.test(hay)) {
    return "workshop_class";
  }
  if (/5k|10k|marathon|tournament|game\b|match\b|baseball|basketball|soccer|race\b/.test(hay)) {
    return "sports";
  }
  if (/hike|trail run|kayak|paddle|outdoor movie|campfire|stargazing|bird walk/.test(hay)) {
    return "outdoor_recreation";
  }
  if (/tasting|wine|brewery|dinner|brunch|food truck|restaurant week|supper club/.test(hay)) {
    return "food_drink";
  }
  if (/kids|family|children|storytime|touch-a-truck/.test(hay)) return "family_event";
  if (/holiday|christmas|halloween|fourth of july|summer concert series|harvest/.test(hay)) {
    return "seasonal_event";
  }
  if (/town hall|community meeting|neighborhood|block party|volunteer/.test(hay)) {
    return "community_gathering";
  }

  switch (event.category) {
    case "music":
    case "nightlife":
      return "concert";
    case "comedy":
    case "arts":
      return "theater";
    case "market":
      return "farmers_market";
    case "food":
      return "food_drink";
    case "sports":
      return "sports";
    case "family":
      return "family_event";
    case "community":
      return "community_gathering";
    default:
      return "general";
  }
}

function significantTokens(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s'-]/g, " ")
        .split(/\s+/)
        .map((word) => word.replace(/^['-]+|['-]+$/g, ""))
        .filter((word) => word.length > 3 && !STOP_WORDS.has(word))
    ),
  ];
}

export function extractEventIdentityTokens(event: Pick<LocalEvent, "name" | "venue">): string[] {
  const venue =
    event.venue.trim() && event.venue.trim().toLowerCase() !== "venue tba"
      ? event.venue.trim()
      : "";
  return [...new Set([...significantTokens(event.name), ...significantTokens(venue)])].slice(0, 8);
}

const LISTING_ONLY_OPENER =
  /^(?:[\w\s,'-]+ is (?:scheduled|listed|on|happening)|an event is happening|join us for|come out for)\b/i;

export function passesEventGoldenTest(input: {
  name: string;
  venue: string;
  banditNote?: string | null;
  editorialBody?: string[] | null;
}): boolean {
  const copy = [input.banditNote, ...(input.editorialBody ?? [])]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (!copy) return false;

  const tokens = extractEventIdentityTokens(input);
  if (!tokens.length) return copy.length >= 40;

  const hay = copy.toLowerCase();
  const hits = tokens.filter((token) => hay.includes(token.toLowerCase()));
  if (hits.length < Math.min(2, tokens.length)) return false;

  const firstParagraph = input.editorialBody?.[0]?.trim() ?? input.banditNote?.trim() ?? "";
  if (firstParagraph && LISTING_ONLY_OPENER.test(firstParagraph)) {
    if (firstParagraph.split(/\s+/).length < 18) return false;
  }

  const lastParagraph = extractLastParagraph(input.editorialBody ?? []);
  if (lastParagraph) {
    if (
      !passesUniqueConclusionTest(lastParagraph, {
        subjectTokens: tokens,
      })
    ) {
      return false;
    }
  }

  const editorialCopy = input.editorialBody ?? [];
  if (editorialCopy.length) {
    if (
      !passesLastingThoughtTest(editorialCopy, {
        subjectTokens: tokens,
      })
    ) {
      return false;
    }
  }

  return true;
}
