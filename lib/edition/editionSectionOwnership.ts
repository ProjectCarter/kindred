/**
 * Strict desk ownership — Local Events vs Food & Drinks vs exclude.
 * Shared by staged build workers and client parsers (defense in depth).
 */

import { isGenericEventTitle } from "./venueQuality.ts";

export type EditionDeskSection = "local_events" | "food_drinks" | "exclude";

export type EventListingInput = {
  name: string;
  venue?: string | null;
  city?: string | null;
  category?: string | null;
  sourceUrl?: string | null;
  banditNote?: string | null;
  editorialHeadline?: string | null;
};

const GENUINE_FOOD_EVENT_PATTERN =
  /\b(food festival|food fest|taste of|restaurant week|beer festival|wine festival|farmers?\s*market|food truck fest(?:ival)?|culinary festival|chili cook.?off|bbq competition|iron chef|chef battle|pop.?up dinner|ticketed dinner|dining experience|chef(?:'s)? table|food & wine|food and wine)\b/i;

const FOOD_VENUE_LISTING_PATTERN =
  /\b(restaurant|cafe|café|coffee shop|bakery|brewery|winery|wine bar|cocktail bar|sports bar|bistro|brunch|diner|pizzeria|steakhouse|eatery|tavern|grill\b|cantina|ramen|sushi bar|happy hour|wine night|taco tuesday|bar & grill)\b/i;

const NIGHTLIFE_VENUE_PATTERN =
  /\b(nightclub|night club|strip club|gentlemen'?s club|adult club|cabaret lounge|drag show|drag brunch|drag bingo|drag night|burlesque show)\b/i;

const MALFORMED_TITLE_PATTERNS: RegExp[] = [
  /^contact us\b/i,
  /^events calendar\b/i,
  /^view all events\b/i,
  /^events$/i,
  /^calendar$/i,
  /^placeholder\b/i,
  /lorem ipsum/i,
  /^tbd\b/i,
  /^event$/i,
  /^listing$/i,
  /^untitled\b/i,
];

const MALFORMED_URL_PATTERNS: RegExp[] = [
  /\/contact(?:\/|$|\?)/i,
  /\/events-calendar/i,
  /\/calendar(?:\/|$|\?)/i,
  /\/placeholder/i,
];

function listingHay(input: EventListingInput): string {
  return [input.name, input.venue, input.city, input.category]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function isMalformedEventListing(input: EventListingInput): boolean {
  const name = input.name?.trim() ?? "";
  if (!name || name.length < 3) return true;
  if (isGenericEventTitle(name) && name.split(/\s+/).length <= 2) return true;
  if (MALFORMED_TITLE_PATTERNS.some((re) => re.test(name))) return true;

  const url = input.sourceUrl?.trim() ?? "";
  if (url && MALFORMED_URL_PATTERNS.some((re) => re.test(url))) return true;

  const venue = input.venue?.trim() ?? "";
  if (/^venue tba$/i.test(venue) && !input.city?.trim()) return true;

  return false;
}

export function isGenuineTicketedFoodEvent(input: EventListingInput): boolean {
  const hay = listingHay(input);
  return GENUINE_FOOD_EVENT_PATTERN.test(hay);
}

export function isFoodVenueListingEvent(input: EventListingInput): boolean {
  if (isGenuineTicketedFoodEvent(input)) return false;
  const hay = listingHay(input);
  if (input.category === "food") return true;
  return FOOD_VENUE_LISTING_PATTERN.test(hay);
}

export function isNightlifeListingEvent(input: EventListingInput): boolean {
  const hay = listingHay(input);
  if (input.category === "nightlife") return true;
  return NIGHTLIFE_VENUE_PATTERN.test(hay);
}

/** Where a catalog event row belongs before persistence. */
export function classifyEventListingSection(
  input: EventListingInput
): EditionDeskSection {
  if (isMalformedEventListing(input)) return "exclude";
  if (isNightlifeListingEvent(input)) return "exclude";
  if (isFoodVenueListingEvent(input)) return "food_drinks";
  return "local_events";
}

export function filterEventsForLocalEventsDesk<T extends EventListingInput>(
  events: readonly T[]
): { kept: T[]; reroutedFood: T[]; excluded: T[] } {
  const kept: T[] = [];
  const reroutedFood: T[] = [];
  const excluded: T[] = [];

  const seen = new Set<string>();
  for (const event of events) {
    const key = `${event.name.trim().toLowerCase()}|${(event.venue ?? "").trim().toLowerCase()}|${(event.sourceUrl ?? "").trim().toLowerCase()}`;
    if (seen.has(key)) {
      excluded.push(event);
      continue;
    }
    seen.add(key);

    const desk = classifyEventListingSection(event);
    if (desk === "local_events") kept.push(event);
    else if (desk === "food_drinks") reroutedFood.push(event);
    else excluded.push(event);
  }

  return { kept, reroutedFood, excluded };
}

/** Map legacy section_type values to the canonical Food & Drinks desk key. */
export function normalizeEditionSectionType(sectionType: string): string {
  if (sectionType === "recommendations") return "food_drinks";
  return sectionType;
}

export function isFoodDrinksSectionType(sectionType: string): boolean {
  const normalized = normalizeEditionSectionType(sectionType);
  return normalized === "food_drinks";
}
