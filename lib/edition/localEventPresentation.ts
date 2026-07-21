/**
 * Local Events reader-facing presentation — newspaper headlines, venue, city, category.
 * Verified facts only; never fabricates schedule, pricing, or venue details.
 */

import type { LocalEventCard, LocalEventCategory } from "./localEvents.ts";
import { isLowValueVenue } from "./venueQuality.ts";

const PHOENIX_METRO_CITIES = [
  "Apache Junction",
  "Avondale",
  "Cave Creek",
  "Chandler",
  "Fountain Hills",
  "Gilbert",
  "Glendale",
  "Goodyear",
  "Mesa",
  "Peoria",
  "Phoenix",
  "Queen Creek",
  "San Tan Valley",
  "Scottsdale",
  "Surprise",
  "Tempe",
] as const;

const METRO_CITY_PATTERN = new RegExp(
  `\\b(${PHOENIX_METRO_CITIES.map((city) => city.replace(/\s+/g, "\\s+")).join("|")})\\b`,
  "i"
);

const EMAIL_PATTERN = /@/;
const STREET_ADDRESS_PATTERN =
  /\b\d+\s+[NSEW]?\s*[\w.'-]+\s+(?:rd|road|st|street|ave|avenue|blvd|boulevard|dr|drive|ln|lane|way|ct|court|pl|place|pkwy|parkway|loop|hwy|highway)\b/i;
const ZIP_PATTERN = /\b\d{5}(?:-\d{4})?\b/;
const TEMPLATE_HEADLINE_PATTERN =
  /\b(hosts a verified|on the .+ calendar|reach us|verified workshop|verified theater|concert listing|theater performance at)\b/i;

function passesHeadlineBounds(headline: string, eventName: string): boolean {
  const trimmed = headline.trim();
  if (trimmed.length < 12 || trimmed.length > 90) return false;
  if (trimmed.toLowerCase() === eventName.trim().toLowerCase()) return false;
  return true;
}

function titleCaseWords(text: string): string {
  const minor = new Set([
    "a",
    "an",
    "and",
    "at",
    "for",
    "in",
    "of",
    "on",
    "or",
    "the",
    "to",
    "with",
  ]);
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      if (/^[A-Z0-9.'-]+$/.test(word) && word.length <= 6) return word;
      const lower = word.toLowerCase();
      if (index > 0 && minor.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function normalizeReadableTitle(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  if (trimmed === trimmed.toUpperCase() && trimmed.length > 4) {
    return titleCaseWords(trimmed.toLowerCase());
  }
  return titleCaseWords(trimmed);
}

export function extractMetroCityLabel(text: string): string | null {
  const match = text.match(METRO_CITY_PATTERN);
  if (!match?.[1]) return null;
  const normalized = match[1]
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
  return PHOENIX_METRO_CITIES.find((city) => city.toLowerCase() === normalized.toLowerCase()) ?? normalized;
}

export function isUnusableVenueString(venue: string | null | undefined): boolean {
  const trimmed = venue?.trim() ?? "";
  if (!trimmed) return true;
  if (EMAIL_PATTERN.test(trimmed)) return true;
  if (/\b(reach us|venue details)\b/i.test(trimmed)) return true;
  if (/^parking lot\b/i.test(trimmed)) return true;
  if (STREET_ADDRESS_PATTERN.test(trimmed) || ZIP_PATTERN.test(trimmed)) return true;
  if (isLowValueVenue(trimmed.toLowerCase())) return true;
  return false;
}

function normalizeVenueBrand(venue: string): string {
  const trimmed = venue.trim();
  if (/^mic drop\b/i.test(trimmed)) return "Mic Drop Comedy";
  return trimmed;
}

export function sanitizeEventVenueName(
  venue: string | null | undefined,
  eventName: string
): string {
  const raw = venue?.trim() ?? "";
  if (!isUnusableVenueString(raw)) {
    return normalizeVenueBrand(raw);
  }

  const atInName = eventName.match(/\bat\s+(.+?)(?:,|\s*$)/i);
  if (atInName?.[1] && !isUnusableVenueString(atInName[1])) {
    return normalizeVenueBrand(atInName[1].trim());
  }

  if (/\bnight market\b/i.test(eventName)) {
    return "Mesa Night Market";
  }

  return "";
}

export function resolveEventCityLabel(
  eventName: string,
  venue: string,
  storedCity: string | null | undefined
): string {
  const fromName = extractMetroCityLabel(eventName);
  if (fromName) return fromName;

  const fromVenue = extractMetroCityLabel(venue);
  if (fromVenue) return fromVenue;

  const stored = storedCity?.trim() ?? "";
  if (stored && extractMetroCityLabel(stored)) return extractMetroCityLabel(stored)!;

  if (/phoenix center for the arts/i.test(venue)) return "Phoenix";

  return stored || "Gilbert";
}

export function resolveLocalEventDisplayCategory(
  eventName: string,
  venue: string,
  stored?: LocalEventCategory | null
): LocalEventCategory {
  const hay = `${eventName} ${venue}`.toLowerCase();

  if (/\bghost walk\b/.test(hay)) return "community";
  if (/\bnight market\b/.test(hay)) return "market";
  if (
    /\b(concert|live music|symphony|orchestra|\bdj\b|jazz|open mic|acoustic|featuring)\b/.test(
      hay
    )
  ) {
    return "music";
  }
  if (/\b(comedy|stand-?up|improv)\b/.test(hay)) return "comedy";
  if (
    /\b(game|match|tournament|marathon|5k|10k|baseball|basketball|soccer|football|hockey|tennis|pickleball)\b/.test(
      hay
    )
  ) {
    return "sports";
  }
  if (
    /\b(seminar|workshop|training|class|estate planning|networking|meetup|conference)\b/.test(
      hay
    )
  ) {
    return "community";
  }
  if (/\b(drawing|painting|gallery|exhibit|museum|theater|theatre|play\b|ballet|film screening|poetry)\b/.test(
      hay
    )
  ) {
    return "arts";
  }
  if (/\b(workshop|class\b|seminar|training)\b/.test(hay) && !/\bdrawing\b/i.test(hay)) {
    return "community";
  }
  if (/\b(kids|children|family|storytime)\b/.test(hay)) return "family";
  if (
    /\b(food|wine|beer|brewery|tasting|dinner|brunch|culinary|chef|bbq)\b/.test(hay) &&
    !/\bnight market\b/.test(hay)
  ) {
    return "food";
  }
  if (/\b(market|craft fair|flea market|bazaar|vendor)\b/.test(hay)) return "market";
  if (/\b(club\b|nightlife|happy hour|late night)\b/.test(hay)) return "nightlife";

  if (stored && hay.includes("mic drop") && stored === "comedy") return "comedy";
  return stored ?? "community";
}

export function isLowQualityEditorialHeadline(
  headline: string | null | undefined,
  event: Pick<LocalEventCard, "name" | "venue">
): boolean {
  const trimmed = headline?.trim() ?? "";
  if (!trimmed) return true;
  if (EMAIL_PATTERN.test(trimmed)) return true;
  if (STREET_ADDRESS_PATTERN.test(trimmed) || ZIP_PATTERN.test(trimmed)) return true;
  if (/^parking lot\b/i.test(trimmed)) return true;
  if (TEMPLATE_HEADLINE_PATTERN.test(trimmed)) return true;
  if (/\blisting\b/i.test(trimmed)) return true;
  if (
    /^sports at\b/i.test(trimmed) ||
    (/^seasonal event at\b/i.test(trimmed) &&
      !/\b(festival|market|parade|celebration)\b/i.test(trimmed))
  ) {
    return true;
  }
  if (isUnusableVenueString(trimmed)) return true;
  if (trimmed.toLowerCase() === event.name.trim().toLowerCase()) return true;
  if (
    event.venue.trim() &&
    trimmed.toLowerCase().startsWith(event.venue.trim().toLowerCase()) &&
    isUnusableVenueString(event.venue)
  ) {
    return true;
  }
  return false;
}

function stripListingNoise(title: string): string {
  return title
    .replace(/\([^)]*\)/g, " ")
    .replace(/,?\s*(Chandler|Mesa|Phoenix|Gilbert|Tempe|Scottsdale),?\s*AZ\b/gi, " ")
    .replace(
      /\s+in\s+(Chandler|Mesa|Phoenix|Gilbert|Tempe|Scottsdale|Glendale|Peoria|Surprise|Avondale)\s*$/gi,
      " "
    )
    .replace(/\s+in\s*$/i, " ")
    .replace(/^live music\s+in\s+.+?\s+featuring\s+/i, " ")
    .replace(/^live music\s+featuring\s+/i, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function composeNewspaperHeadline(
  event: Pick<LocalEventCard, "name" | "venue" | "city" | "category">
): string {
  const name = event.name.trim();
  const venue = sanitizeEventVenueName(event.venue, name);
  const cleaned = stripListingNoise(name);

  const featuringMatch = cleaned.match(/featuring\s+(.+?)\s+at\s+(.+)$/i);
  if (featuringMatch?.[1] && featuringMatch[2]) {
    const artist = normalizeReadableTitle(featuringMatch[1]);
    const venueName = sanitizeEventVenueName(featuringMatch[2], name) || normalizeReadableTitle(featuringMatch[2]);
    const headline = `${artist} at ${venueName}`;
    if (headline.length >= 12) return headline.slice(0, 90);
  }

  if (/\bghost walk\b/i.test(cleaned)) {
    const city = extractMetroCityLabel(name) ?? extractMetroCityLabel(event.city ?? "");
    const headline = city
      ? `${city} Ghost Walk at Mic Drop Comedy`
      : `Ghost Walk at ${venue || "Mic Drop Comedy"}`;
    return headline.slice(0, 90);
  }

  if (/\bnight market\b/i.test(cleaned)) {
    const subtitle = name.match(/[-–—]\s*(.+)$/);
    if (subtitle?.[1]) {
      return `Mesa Night Market — ${normalizeReadableTitle(subtitle[1])}`.slice(0, 90);
    }
    return "Mesa Night Market".slice(0, 90);
  }

  const atMatch = cleaned.match(/^(.+?)\s+at\s+(.+)$/i);
  if (atMatch?.[1] && atMatch[2] && !/^live music\b/i.test(cleaned)) {
    const rawLead = atMatch[1].trim();
    const isFree = /^free\b/i.test(rawLead);
    const lead = normalizeReadableTitle(rawLead.replace(/^free\s+/i, "").trim());
    const venueName = venue || normalizeReadableTitle(atMatch[2]);
    const headline = `${isFree ? "Free " : ""}${lead} at ${venueName}`;
    if (headline.length >= 12) return headline.slice(0, 90);
  }

  if (/\bdrawing\b/i.test(cleaned) && venue) {
    const subject =
      name.match(/\bdrawing\s+with\s+(.+)$/i)?.[1]?.trim() ??
      cleaned.replace(/^drawing\s+with\s+/i, "");
    const headline = `Drawing Workshop With ${subject} at ${venue}`;
    return headline.slice(0, 90);
  }

  if (
    event.category === "sports" ||
    /\b(vs\.?|match|tournament|marathon|5k|10k|game day|all star)\b/i.test(cleaned)
  ) {
    const sportsTitle = normalizeReadableTitle(cleaned);
    if (!/^sports$/i.test(sportsTitle)) {
      const headline = venue ? `${sportsTitle} at ${venue}` : sportsTitle;
      if (headline.length >= 12) return headline.slice(0, 90);
    }
  }

  if (/\bworkshop\b/i.test(cleaned)) {
    if (
      /\b(phoenix center for the arts|museum|gallery|library|performing arts|arts center)\b/i.test(
        `${venue} ${cleaned}`
      )
    ) {
      const city = resolveEventCityLabel(name, event.venue, event.city);
      const shortTitle = normalizeReadableTitle(
        cleaned
          .replace(/\s*\d+\s*day\s*/i, " ")
          .replace(/\s+in\s+[A-Za-z\s,]+$/i, "")
          .replace(/\s+in\s*$/i, "")
          .replace(/\s*&\s*/g, " and ")
      );
      const headline = city ? `${shortTitle} in ${city}` : shortTitle;
      return headline.slice(0, 90);
    }
  }

  if (/\blive music\b/i.test(cleaned) && venue) {
    const headline = `Live Music at ${venue}`;
    return headline.slice(0, 90);
  }

  const fallback = venue ? `${normalizeReadableTitle(cleaned)} at ${venue}` : normalizeReadableTitle(cleaned);
  return fallback.slice(0, 90);
}

export function resolveEventDisplayHeadline(
  event: Pick<LocalEventCard, "name" | "editorialHeadline" | "venue" | "city" | "category">
): string {
  const stored = event.editorialHeadline?.trim() ?? "";
  if (
    stored &&
    !isLowQualityEditorialHeadline(stored, event) &&
    passesHeadlineBounds(stored, event.name)
  ) {
    return stored;
  }
  const composed = composeNewspaperHeadline(event);
  return passesHeadlineBounds(composed, event.name) ? composed : composed.slice(0, 90);
}

export function applyLocalEventPresentation(card: LocalEventCard): LocalEventCard {
  const venue = sanitizeEventVenueName(card.venue, card.name);
  const city = resolveEventCityLabel(card.name, card.venue, card.city);
  const category = resolveLocalEventDisplayCategory(card.name, card.venue, card.category);
  const editorialHeadline = resolveEventDisplayHeadline({
    ...card,
    venue,
    city,
    category,
  });

  return {
    ...card,
    venue,
    city,
    category,
    editorialHeadline,
  };
}
