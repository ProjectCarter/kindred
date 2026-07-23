/**
 * Local Events editorial copy — verified facts only, no template library.
 * Editorial law: docs/editorial/EVENT_EDITORIAL_STANDARD.md
 */

import type { LocalEventCard, LocalEventCategory } from "./localEvents.ts";
import { eventCategoryLabel } from "./localEvents.ts";
import { containsEngineLanguage } from "./editorialVoice.ts";
import { containsGenericAiPhrase } from "./editorialIntelligence.ts";
import {
  filterHumanDetailParagraphs,
  humanDetailObservationForEventCategory,
} from "./humanDetails.ts";
import {
  ensureLastingImpressionClosing,
  lastingImpressionClosingForEvent,
} from "./lastingImpression.ts";
import {
  filterSourceConfidenceParagraphs,
} from "./sourceConfidence.ts";
import {
  applyEditionVarietyToBody,
  buildVarietySeed,
} from "./editionVariety.ts";
import type { EventInfoBadgeId } from "./eventBadges.ts";
import { passesEventGoldenTest } from "./eventStorytelling.ts";

/** Permanently banned — never publish in Bandit's Note or event articles. */
export const BANNED_EVENT_EDITORIAL_PATTERNS: RegExp[] = [
  /\bworth stepping out for\b/i,
  /\bworth leaving the house for\b/i,
  /\bthis is the kind of plan\b/i,
  /\bshow up with curiosity\b/i,
  /\bperfect evening\b/i,
  /\bhidden gem\b/i,
  /\bsomething for everyone\b/i,
  /\bworth rearranging an evening for\b/i,
  /\ba local moment worth\b/i,
  /\bthe best local evenings rarely\b/i,
  /\bnothing about this needs to be a big production\b/i,
  /\bthe rest is worth discovering in person\b/i,
  /\beverything beyond the basics is best found by going\b/i,
  /\bfestivals like this are where a town actually shows up\b/i,
  /\ba festival is one of the few times a whole town\b/i,
  /\bworth catching while it is still on the calendar\b/i,
  /\bthe sort of evening that is easy to postpone\b/i,
  /\bgood for anyone who likes discovering what is on nearby\b/i,
  /\ban idea worth a look today\b/i,
  /\blooking for something different\b/i,
  /\bdon't miss\b/i,
  /\bdo not miss\b/i,
  /\bmark your calendar\b/i,
  /\bgather your friends\b/i,
  /\bperfect way to spend\b/i,
  /\bjoin us for\b/i,
  /\bcome out for\b/i,
  /\bfun for the whole family\b/i,
  /\bgreat way to spend\b/i,
];

export function containsBannedEventCopy(text: string | null | undefined): boolean {
  const raw = text?.trim();
  if (!raw) return false;
  return (
    BANNED_EVENT_EDITORIAL_PATTERNS.some((pattern) => pattern.test(raw)) ||
    containsGenericAiPhrase(raw)
  );
}

export function sanitizeEventEditorialParagraphs(paragraphs: string[]): string[] {
  const humanDetailFiltered = filterHumanDetailParagraphs(
    paragraphs
      .map((p) => p.replace(/\s+/g, " ").trim())
      .filter(
        (p) =>
          p.length >= 20 &&
          !containsEngineLanguage(p) &&
          !containsBannedEventCopy(p)
      )
  );
  return filterSourceConfidenceParagraphs(humanDetailFiltered, { desk: "events" });
}

function eventPlaceLine(event: Pick<LocalEventCard, "venue" | "city">): string {
  const venue =
    event.venue?.trim() && event.venue.trim() !== "Venue TBA"
      ? event.venue.trim()
      : null;
  const city = event.city?.trim() || null;
  return [venue, city].filter(Boolean).join(", ");
}

function eventWhenLine(event: Pick<LocalEventCard, "date" | "time">): string | null {
  const parts = [event.date, event.time].filter(
    (part) => part?.trim() && !/TBA|see listing/i.test(part)
  );
  return parts.length ? parts.join(" · ") : null;
}

const BADGE_FACT: Partial<Record<EventInfoBadgeId, string>> = {
  free: "Admission is listed as free.",
  live_music: "Live music is listed as part of the program.",
  food_drinks: "Food or drinks are listed as part of the experience.",
  tickets_required: "Tickets or registration are required — confirm on the listing.",
  dog_friendly: "The listing notes the event as dog-friendly.",
  free_parking: "Free parking is noted on the listing.",
};

function verifiedBadgeFacts(badges: EventInfoBadgeId[] | undefined): string[] {
  if (!badges?.length) return [];
  const lines: string[] = [];
  for (const badge of badges) {
    const fact = BADGE_FACT[badge];
    if (fact) lines.push(fact);
  }
  return lines;
}

function categoryFact(category: LocalEventCategory | undefined): string | null {
  const label = eventCategoryLabel(category);
  if (!label) return null;
  return `Kindred classified this listing under ${label} based on the event title and venue.`;
}

function hostFact(event: LocalEventCard): string | null {
  const host = event.sourceName?.trim();
  if (!host) return null;
  return `Listing sourced from ${host}.`;
}

function listingFact(event: LocalEventCard): string | null {
  if (event.officialWebsite?.trim()) {
    return `The organizer's site is linked below for schedules, tickets, and any updates.`;
  }
  if (event.sourceUrl?.trim()) {
    return `Confirm times, tickets, and any last-minute changes on the source listing below.`;
  }
  return null;
}

/**
 * Factual event article body — no canned lifestyle copy.
 * Uses frozen editorialBody from edition build when present and valid.
 */
export function composeEventArticleFromVerifiedData(
  event: LocalEventCard,
  options?: { editionDate?: string | null }
): string[] {
  const varietySeed = buildVarietySeed(options?.editionDate, event.name.trim());
  const frozen = sanitizeEventEditorialParagraphs(event.editorialBody ?? []);
  if (
    frozen.length >= 2 &&
    passesEventGoldenTest({
      name: event.name,
      venue: event.venue,
      banditNote: event.banditNote,
      editorialBody: frozen,
    })
  ) {
    return applyEditionVarietyToBody(
      ensureLastingImpressionClosing(
        frozen,
        lastingImpressionClosingForEvent(
          event.name.trim(),
          options?.editionDate ?? event.name.trim(),
          event.category ?? null
        )
      ),
      varietySeed
    );
  }

  const name = event.name.trim();
  const place = eventPlaceLine(event);
  const when = eventWhenLine(event);
  const paragraphs: string[] = [];

  const schedule =
    when && place
      ? `${name} is scheduled for ${when} at ${place}.`
      : when
        ? `${name} is scheduled for ${when}.`
        : place
          ? `${name} takes place at ${place}.`
          : `${name} is listed as an upcoming local event.`;
  paragraphs.push(schedule);

  const note = event.banditNote?.trim();
  if (
    note &&
    !containsBannedEventCopy(note) &&
    !containsEngineLanguage(note) &&
    !paragraphs.some((p) => p.includes(note))
  ) {
    paragraphs.push(note);
  }

  const humanDetail = humanDetailObservationForEventCategory(event.category);
  if (
    humanDetail &&
    !paragraphs.some((p) => p === humanDetail || p.includes(humanDetail)) &&
    !paragraphs.some((p) => humanDetail.includes(p))
  ) {
    paragraphs.push(humanDetail);
  }

  for (const fact of verifiedBadgeFacts(event.badges)) {
    if (!paragraphs.some((p) => p === fact)) paragraphs.push(fact);
  }

  const category = categoryFact(event.category);
  if (category && !paragraphs.some((p) => p === category)) {
    paragraphs.push(category);
  }

  const host = hostFact(event);
  if (host && !paragraphs.some((p) => p === host)) paragraphs.push(host);

  const listing = listingFact(event);
  if (listing && !paragraphs.some((p) => p === listing)) paragraphs.push(listing);

  return applyEditionVarietyToBody(
    ensureLastingImpressionClosing(
      sanitizeEventEditorialParagraphs(paragraphs),
      lastingImpressionClosingForEvent(
        name,
        options?.editionDate ?? name,
        event.category ?? null
      )
    ),
    varietySeed
  );
}

export function validateBanditNote(note: string | null | undefined): string | null {
  const trimmed = note?.trim();
  if (!trimmed) return null;
  if (containsBannedEventCopy(trimmed)) return null;
  if (containsEngineLanguage(trimmed)) return null;
  if (trimmed.length < 12 || trimmed.length > 140) return null;
  return trimmed;
}

export function validateEditorialHeadline(
  headline: string | null | undefined,
  eventName: string
): string | null {
  const trimmed = headline?.trim();
  if (!trimmed) return null;
  if (containsBannedEventCopy(trimmed)) return null;
  if (containsEngineLanguage(trimmed)) return null;
  if (trimmed.length < 12 || trimmed.length > 90) return null;
  if (trimmed.toLowerCase() === eventName.trim().toLowerCase()) return null;
  return trimmed;
}
