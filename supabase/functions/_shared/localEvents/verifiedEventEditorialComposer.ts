/**
 * Compose Local Events editorial from verified catalog fields only — no LLM.
 * Used when Anthropic is unavailable or for batch backfill after catalog sync.
 */

import { buildVarietySeed } from "../editorial/editionVariety.ts";
import {
  ensureLastingImpressionClosing,
  lastingImpressionClosingForEvent,
} from "../editorial/lastingImpression.ts";
import { humanDetailObservationForEventCategory } from "../editorial/humanDetails.ts";
import type { LocalEvent } from "./provider.ts";
import {
  EVENT_EDITORIAL_MAX_PARAGRAPHS,
  EVENT_EDITORIAL_MIN_PARAGRAPHS,
  resolveEditorialHeadline,
  sanitizeEventEditorialParagraphs,
  validateBanditNote,
  type GeneratedEventEditorial,
} from "./eventEditorial.ts";
import {
  classifyEventStoryType,
  extractEventIdentityTokens,
  STORY_TYPE_LABEL,
  type EventStoryType,
} from "./eventStorytelling.ts";
import { passesEventGoldenTest } from "./eventStorytelling.ts";

const CATEGORY_LABEL: Record<string, string> = {
  music: "Music",
  comedy: "Comedy",
  arts: "Arts",
  family: "Family",
  sports: "Sports",
  food: "Food & Drink",
  market: "Market",
  nightlife: "Nightlife",
  community: "Community",
};

const BADGE_FACT: Record<string, string> = {
  free: "Admission is listed as free on the verified listing.",
  live_music: "Live music is listed as part of the program.",
  food_drinks: "Food or drinks are listed as part of the experience.",
  tickets_required: "Tickets or registration are required — confirm availability on the listing below.",
  dog_friendly: "The listing notes the event as dog-friendly.",
  free_parking: "Free parking is noted on the listing.",
};

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pickVariant<T>(items: T[], seed: string): T {
  return items[hashString(seed) % items.length]!;
}

function placeLine(event: LocalEvent): string {
  const venue =
    event.venue?.trim() && event.venue.trim().toLowerCase() !== "venue tba"
      ? event.venue.trim()
      : null;
  const city = event.city?.trim() || null;
  return [venue, city].filter(Boolean).join(", ");
}

function categoryLabel(event: LocalEvent): string | null {
  if (!event.category) return null;
  return CATEGORY_LABEL[event.category] ?? event.category;
}

function openingParagraph(
  event: LocalEvent,
  storyType: EventStoryType,
  seed: string
): string {
  const venue = event.venue.trim();
  const city = event.city.trim();
  const when = event.startDateTime.trim();
  const label = STORY_TYPE_LABEL[storyType];
  const place = placeLine(event);

  const byType: Record<EventStoryType, string[]> = {
    concert: [
      `${venue} is the room for this ${label.toLowerCase()} listing in ${city}, with ${event.name.trim()} on the verified schedule ${when.toLowerCase().includes("today") ? "today" : "on the date below"}.`,
      `Live music brings ${event.name.trim()} to ${venue} ${when.toLowerCase().includes("today") ? "tonight" : "on the listed date"} — a ${city} calendar entry Kindred verified before publication.`,
      `The draw at ${venue} is a live set: ${event.name.trim()} appears on the ${city} schedule with confirmed showtimes on the listing.`,
    ],
    festival: [
      `${event.name.trim()} reads as a ${label.toLowerCase()} in ${city}${place ? ` at ${place}` : ""}, with the full run of dates on the verified listing below.`,
      `Festival listings like this one anchor a day in ${city}: ${event.name.trim()} is verified for ${when}.`,
    ],
    farmers_market: [
      `Market mornings in ${city} include ${event.name.trim()}${venue ? ` at ${venue}` : ""} — a recurring ${label.toLowerCase()} with hours on the listing.`,
      `${event.name.trim()} is listed as a ${label.toLowerCase()} in ${city}, with vendor hours confirmed on the source page below.`,
    ],
    art_exhibition: [
      `Gallery and exhibition listings in ${city} this week include ${event.name.trim()}${venue ? ` at ${venue}` : ""}, verified for ${when}.`,
      `${event.name.trim()} is billed as an ${label.toLowerCase()}${venue ? ` at ${venue}` : ""} in ${city} on the schedule below.`,
    ],
    museum_event: [
      `${venue} hosts ${event.name.trim()} as a ${label.toLowerCase()} in ${city}, with program times listed on the verified page below.`,
      `Museum programming in ${city} includes ${event.name.trim()} at ${venue} — confirmed on the listing for ${when}.`,
    ],
    theater: [
      `${event.name.trim()} takes the stage at ${venue} in ${city}, a ${label.toLowerCase()} entry with showtimes on the verified listing.`,
      `Theater listings this week in ${city} include ${event.name.trim()} at ${venue}, scheduled for ${when}.`,
    ],
    author_talk: [
      `${event.name.trim()} is listed as an ${label.toLowerCase()}${venue ? ` at ${venue}` : ""} in ${city}, with seating and time details on the source page.`,
      `Readers in ${city} will find ${event.name.trim()} on the calendar as a bookish evening${venue ? ` at ${venue}` : ""}, verified for ${when}.`,
    ],
    community_gathering: [
      `${event.name.trim()} gathers people in ${city}${venue ? ` at ${venue}` : ""} — a ${label.toLowerCase()} with the verified schedule below.`,
      `Neighborhood calendars in ${city} list ${event.name.trim()}${venue ? ` at ${venue}` : ""} for ${when}.`,
    ],
    outdoor_recreation: [
      `${event.name.trim()} is an ${label.toLowerCase()} listing in ${city}${venue ? ` starting from ${venue}` : ""}, with meet-up details on the verified page.`,
      `Open-air plans in ${city} this week include ${event.name.trim()}${venue ? ` at ${venue}` : ""}, confirmed for ${when}.`,
    ],
    food_drink: [
      `${event.name.trim()} is listed under Food & Drink in ${city}${venue ? ` at ${venue}` : ""}, with service times verified on the listing below.`,
      `Dining and tasting calendars in ${city} include ${event.name.trim()} at ${venue} for ${when}.`,
    ],
    workshop_class: [
      `${event.name.trim()} is a hands-on ${label.toLowerCase()}${venue ? ` at ${venue}` : ""} in ${city}, with session times on the verified listing.`,
      `Class listings in ${city} this week include ${event.name.trim()} at ${venue}, scheduled for ${when}.`,
    ],
    sports: [
      `${event.name.trim()} is on the ${city} sports calendar at ${venue}, a ${label.toLowerCase()} entry verified for ${when}.`,
      `Game-day listings in ${city} include ${event.name.trim()} at ${venue}, with start details on the page below.`,
    ],
    family_event: [
      `${event.name.trim()} is listed as a ${label.toLowerCase()} in ${city}${venue ? ` at ${venue}` : ""}, with hours confirmed on the verified listing.`,
      `Family calendars in ${city} include ${event.name.trim()} at ${venue} for ${when}.`,
    ],
    seasonal_event: [
      `${event.name.trim()} ties to the season on the ${city} calendar${venue ? ` at ${venue}` : ""}, verified for ${when}.`,
      `Seasonal listings in ${city} this week include ${event.name.trim()}${venue ? ` at ${venue}` : ""}, with dates on the source page below.`,
    ],
    general: [
      `${event.name.trim()} is a verified ${city} listing${venue ? ` at ${venue}` : ""}, with the confirmed schedule on the page below.`,
      `The ${city} calendar includes ${event.name.trim()}${venue ? ` at ${venue}` : ""} — details verified before this edition went to press.`,
    ],
  };

  return pickVariant(byType[storyType], `${seed}:open`);
}

function scheduleParagraph(event: LocalEvent): string {
  const when = event.startDateTime.trim();
  const place = placeLine(event);
  if (place) {
    return `Doors and start times are listed as ${when} at ${place}. Confirm any updates on the organizer page before you leave home.`;
  }
  return `The verified schedule lists ${when}. Confirm any updates on the organizer page before you leave home.`;
}

function audienceParagraph(event: LocalEvent, storyType: EventStoryType): string | null {
  const label = categoryLabel(event);
  const byType: Partial<Record<EventStoryType, string>> = {
    concert: "Concerts like this one tend to suit anyone following the artist or the room — the listing category and title are the honest guide to tone.",
    comedy: "Stand-up and comedy listings read best for adults who want a seated show; the venue name and title on the listing set expectations.",
    festival: "Festivals on the calendar can suit mixed groups when the listing is family-friendly — check the source page for age notes.",
    farmers_market: "Markets are built for wandering: arrive with a tote, comfortable shoes, and time to browse stalls at your own pace.",
    family_event: "Family listings are meant for parents planning around nap times and parking — the verified hours below matter more than the headline.",
    sports: "Sports listings are straightforward spectator plans — arrive with your ticket link ready and check whether the venue publishes bag policies.",
    workshop_class: "Workshop listings suit people who want a structured activity; registration details on the source page are the practical starting point.",
    food_drink: "Food and drink events can read as date-night or group outings depending on the venue — the listing title and category are your best cue.",
    theater: "Theater listings reward arriving a little early — the verified showtime below is the anchor for the whole evening.",
    museum_event: "Museum programs can suit curious visitors of many ages when the listing is open to the public — confirm ticket rules on the page below.",
  };
  const line = byType[storyType];
  if (line) return line;
  if (label) {
    return `Kindred classified this under ${label} based on the verified title and venue — a useful cue when deciding who to bring along.`;
  }
  return null;
}

function horizonParagraph(event: LocalEvent): string | null {
  const bucket = event.horizonBucket;
  if (bucket === "today") {
    return "This one sits on today's calendar — worth checking the listing once more in case the organizer posted a door-time change.";
  }
  if (bucket === "this_weekend" || bucket === "tomorrow") {
    return "The date is close enough that a quick look at the listing tonight can save a wasted trip tomorrow.";
  }
  if (bucket === "next_week" || bucket === "later") {
    return "With the date still a little way off, bookmark the listing and revisit it midweek for any schedule adjustments.";
  }
  return null;
}

function sourceParagraph(event: LocalEvent): string | null {
  const host = event.sourceName?.trim();
  if (event.officialWebsite?.trim()) {
    return `The organizer's official site is linked below for tickets, maps, and any last-minute updates${host ? ` (sourced via ${host})` : ""}.`;
  }
  if (event.sourceUrl?.trim()) {
    return `Confirm times, tickets, and any changes on the ${host ?? "source"} listing linked below.`;
  }
  return host ? `Listing sourced from ${host}.` : null;
}

function closingParagraph(event: LocalEvent, seed: string): string {
  const venue = event.venue.trim();
  const tokens = extractEventIdentityTokens(event);
  const token = tokens[0] ?? venue.split(/\s+/)[0] ?? event.name.split(/\s+/)[0] ?? "the venue";
  const closings = [
    `Next time you scan the ${event.city.trim()} calendar, notice how ${token} anchors a specific evening rather than a vague night out.`,
    `Long after the listing scrolls past, ${venue} and the date on the page are the two details worth remembering.`,
    `Many first-time visitors overlook how much the venue name — ${venue} — tells you about the evening before you read another line.`,
    `Instead of treating it as background noise on the feed, read ${event.name.trim()} as a dated plan with a real room attached.`,
    `The surprising part is often the pairing: ${event.name.trim()} at ${venue} is specific enough to picture before you go.`,
  ];
  return pickVariant(closings, `${seed}:close`);
}

function banditNoteForEvent(event: LocalEvent, storyType: EventStoryType): string {
  const venue = event.venue.trim();
  const when = event.startDateTime.trim();
  const shortWhen = when.toLowerCase().includes("today") ? "today" : when.split(",")[0]?.trim() ?? when;
  const options = [
    `${event.name.trim()} at ${venue} ${shortWhen}.`,
    `${venue} hosts ${event.name.trim()} on the verified ${STORY_TYPE_LABEL[storyType].toLowerCase()} schedule.`,
    `${STORY_TYPE_LABEL[storyType]} at ${venue}: ${event.name.trim()}, ${shortWhen}.`,
  ];
  const note = pickVariant(options, `${event.name}:${venue}:note`);
  return note.length <= 140 ? note : `${venue} — ${shortWhen}.`;
}

function headlineForEvent(
  event: LocalEvent,
  storyType: EventStoryType,
  seed: string
): string {
  const venue = event.venue.trim();
  const city = event.city.trim();
  const options = [
    `${STORY_TYPE_LABEL[storyType]} at ${venue}`,
    `${venue} on the ${city} calendar`,
    `A ${STORY_TYPE_LABEL[storyType].toLowerCase()} night at ${venue}`,
    `${city} ${STORY_TYPE_LABEL[storyType].toLowerCase()} listing`,
    `${venue} hosts a verified ${STORY_TYPE_LABEL[storyType].toLowerCase()}`,
  ];
  const headline = pickVariant(options, `${seed}:headline`);
  return headline.length <= 90 ? headline : `${STORY_TYPE_LABEL[storyType]} at ${venue}`.slice(0, 90);
}

/** Build publishable editorial from verified catalog fields. */
export function composeVerifiedEventEditorial(
  event: LocalEvent,
  options?: { editionDate?: string | null }
): GeneratedEventEditorial {
  const seed = buildVarietySeed(options?.editionDate, event.name);
  const storyType = classifyEventStoryType(event);

  const rawParagraphs: string[] = [
    openingParagraph(event, storyType, seed),
    scheduleParagraph(event),
  ];

  const human = humanDetailObservationForEventCategory(event.category ?? null);
  if (human) rawParagraphs.push(human);

  const audience = audienceParagraph(event, storyType);
  if (audience) rawParagraphs.push(audience);

  for (const badge of event.badges ?? []) {
    const fact = BADGE_FACT[badge];
    if (fact) rawParagraphs.push(fact);
  }

  const horizon = horizonParagraph(event);
  if (horizon) rawParagraphs.push(horizon);

  const label = categoryLabel(event);
  if (label) {
    rawParagraphs.push(
      `Kindred's events desk filed this under ${label} after verifying the title, venue, and listing source.`
    );
  }

  const source = sourceParagraph(event);
  if (source) rawParagraphs.push(source);

  rawParagraphs.push(closingParagraph(event, seed));

  let body = sanitizeEventEditorialParagraphs(rawParagraphs);

  while (body.length < EVENT_EDITORIAL_MIN_PARAGRAPHS) {
    body.splice(body.length - 1, 0, scheduleParagraph(event));
    body = sanitizeEventEditorialParagraphs(body);
  }
  if (body.length > EVENT_EDITORIAL_MAX_PARAGRAPHS) {
    body = [body[0]!, ...body.slice(1, EVENT_EDITORIAL_MAX_PARAGRAPHS - 1), body.at(-1)!];
  }

  const fallbackClosing = lastingImpressionClosingForEvent(
    event.name.trim(),
    seed,
    event.category ?? null
  );
  body = ensureLastingImpressionClosing(body, fallbackClosing);

  const banditNote = validateBanditNote(banditNoteForEvent(event, storyType));
  const editorialHeadline = resolveEditorialHeadline(
    headlineForEvent(event, storyType, seed),
    event,
    body,
    banditNote
  );

  return { editorialHeadline, banditNote, editorialBody: body };
}

export function composeVerifiedEventEditorialIfPublishable(
  event: LocalEvent,
  options?: { editionDate?: string | null }
): GeneratedEventEditorial | null {
  const copy = composeVerifiedEventEditorial(event, options);
  if (
    !copy.editorialHeadline ||
    !copy.banditNote ||
    !copy.editorialBody?.length ||
    copy.editorialBody.length < EVENT_EDITORIAL_MIN_PARAGRAPHS
  ) {
    return null;
  }
  if (
    !passesEventGoldenTest({
      name: event.name,
      venue: event.venue,
      banditNote: copy.banditNote,
      editorialBody: copy.editorialBody,
    })
  ) {
    return null;
  }
  return copy;
}
