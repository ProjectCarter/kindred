/**
 * Local Events editorial copy — server mirror of lib/edition/eventEditorial.ts
 * Keep banned patterns and brief format in sync with the client module.
 */

import {
  buildEditorialIntelligencePromptBlock,
  containsGenericAiPhrase,
  endingReadsLikeSummary,
  hasMemorableTakeaway,
} from "../editorial/editorialIntelligence.ts";
import { filterHumanDetailParagraphs, buildHumanDetailsPromptBlock } from "../editorial/humanDetails.ts";
import {
  buildLastingImpressionPromptBlock,
  ensureLastingImpressionClosing,
  lastingImpressionClosingForEvent,
  validateLastingImpressionClosing,
} from "../editorial/lastingImpression.ts";
import {
  buildSourceConfidencePromptBlock,
  filterSourceConfidenceParagraphs,
  validateSourceConfidenceBody,
} from "../editorial/sourceConfidence.ts";
import type { LocalEvent } from "./provider.ts";
import { KINDRED_EDITORIAL_STANDARDS_DIGEST } from "../../../../lib/edition/kindredEditorialStandards.ts";
import {
  STORY_TYPE_GUIDANCE,
  STORY_TYPE_LABEL,
  classifyEventStoryType,
  passesEventGoldenTest,
} from "./eventStorytelling.ts";

/** Kindred Local Events desk — full newspaper article per verified listing. */
export const EVENT_EDITORIAL_MIN_PARAGRAPHS = 6;
export const EVENT_EDITORIAL_MAX_PARAGRAPHS = 10;

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
      .filter((p) => p.length >= 20 && !containsBannedEventCopy(p))
  );
  return filterSourceConfidenceParagraphs(humanDetailFiltered, { desk: "events" });
}

export function validateBanditNote(note: string | null | undefined): string | null {
  const trimmed = note?.trim();
  if (!trimmed) return null;
  if (containsBannedEventCopy(trimmed)) return null;
  if (trimmed.length < 12 || trimmed.length > 140) return null;
  return trimmed;
}

/** Newspaper headline — distinct from the listing title, verified facts only. */
export function validateEditorialHeadline(
  headline: string | null | undefined,
  eventName: string
): string | null {
  const trimmed = headline?.trim();
  if (!trimmed) return null;
  if (containsBannedEventCopy(trimmed)) return null;
  if (trimmed.length < 12 || trimmed.length > 90) return null;
  if (trimmed.toLowerCase() === eventName.trim().toLowerCase()) return null;
  return trimmed;
}

export function resolveEditorialHeadline(
  rawHeadline: string | null,
  event: Pick<LocalEvent, "name" | "venue" | "category">,
  body: string[],
  banditNote: string | null
): string | null {
  const direct = validateEditorialHeadline(rawHeadline, event.name);
  if (direct) return direct;

  const candidates = [
    banditNote,
    body[0]?.split(/(?<=[.!?])\s+/)[0]?.trim() ?? body[0]?.trim(),
    body[1]?.split(/(?<=[.!?])\s+/)[0]?.trim() ?? body[1]?.trim(),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const validated = validateEditorialHeadline(candidate, event.name);
    if (validated) return validated;
  }

  return null;
}

const BADGE_LABEL: Record<string, string> = {
  free: "free admission",
  live_music: "live music",
  food_drinks: "food or drinks",
  tickets_required: "tickets required",
  dog_friendly: "dog-friendly",
  free_parking: "free parking",
};

/** Verified event facts for AI — never invent beyond this brief. */
export function buildVerifiedEventBrief(event: LocalEvent, index: number): string {
  const badges = (event.badges ?? [])
    .map((id) => BADGE_LABEL[id] ?? id.replace(/_/g, " "))
    .join(", ");
  const reasons = (event.editorialScore?.reasons ?? [])
    .slice(0, 3)
    .map((r) => r.label)
    .join("; ");
  const category = event.category
    ? CATEGORY_LABEL[event.category] ?? event.category
    : null;
  const storyType = classifyEventStoryType(event);

  return [
    `Event ${index + 1}:`,
    `Story type: ${STORY_TYPE_LABEL[storyType]}`,
    `Writing guidance: ${STORY_TYPE_GUIDANCE[storyType]}`,
    `Title: ${event.name.trim()}`,
    `Schedule: ${event.startDateTime.trim()}`,
    event.startDateIso ? `Start date (ISO): ${event.startDateIso}` : null,
    `Venue: ${event.venue.trim()}`,
    `City: ${event.city.trim()}`,
    category ? `Category: ${category}` : null,
    badges ? `Listing badges: ${badges}` : null,
    badges?.includes("free parking")
      ? "Parking note: listing marks free parking — you may mention it in a practical paragraph only."
      : null,
    event.sourceName ? `Source: ${event.sourceName.trim()}` : null,
    event.officialWebsite?.trim()
      ? `Official site: ${event.officialWebsite.trim()}`
      : null,
    event.sourceUrl?.trim() ? `Listing URL: ${event.sourceUrl.trim()}` : null,
    event.horizonBucket ? `Horizon: ${event.horizonBucket}` : null,
    reasons ? `Editorial signals: ${reasons}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export const EVENT_EDITORIAL_SYSTEM_PROMPT =
  "You are Bandit, Kindred's local newspaper editor. Kindred is a newspaper, not an event directory.\n\n" +
  `${KINDRED_EDITORIAL_STANDARDS_DIGEST}\n\n` +
  "BEFORE WRITING each event, read its Story type and Writing guidance in the brief.\n" +
  "A concert reads differently from a farmers market. A theater performance reads differently from a food festival.\n" +
  "Do NOT use one writing style for every category.\n\n" +
  "Return ONLY JSON:\n" +
  '{"events":[{"editorialHeadline":"...","banditNote":"...","editorialBody":["p1","p2","p3","p4","p5","p6"]}]}\n\n' +
  "editorialHeadline: ONE newspaper-quality headline (12–90 chars) — specific to THIS event, " +
  "not the raw listing title, no exclamation points\n" +
  "SUMMARIZE THE EXPERIENCE — do not restate the listing:\n" +
  "- Explain what is happening, why someone would attend, what makes it unique, what to expect\n" +
  "- Describe atmosphere and energy when inferable from category/story type — never invent crowd size\n" +
  "- Say who it is best for (families, date night, longtime fans) only when the brief supports it\n" +
  "- Include practical tips from verified badges/schedule (tickets, free admission, parking if listed)\n" +
  "- Vary paragraph length — mix one short punchy paragraph with longer ones\n" +
  "- Smooth transitions: each paragraph opens differently; never repeat the event title to start two paragraphs\n" +
  "- End with a closing thought specific to THIS event — never a reusable Kindred wrap-up\n\n" +
  "Rules:\n" +
  "- banditNote: ONE sentence, max 18 words, specific to THIS event\n" +
  "- editorialBody: 6–10 paragraphs; each adds NEW verified facts, practical context, or honest atmosphere\n" +
  "- Paragraph roles ( weave naturally — do not label them ): what it is · who it suits · when to go · " +
  "venue or format detail · planning tip from verified badges/schedule · one quiet closing thought\n" +
  "- Use ONLY facts from the event brief — never invent parking, menus, crowd counts, or nearby places\n" +
  "- If verified detail is missing, write less — never fill with guesses\n" +
  "- Calm newspaper voice; no exclamation points; no hashtags\n" +
  "- Golden test: hide the title — the copy must describe ONLY this event\n" +
  "- Permanently banned: \"Worth stepping out for\", \"This is the kind of plan\", \"Show up with curiosity\", " +
  "\"Looking for something different\", \"Don't miss\", \"Mark your calendar\", \"Gather your friends\", " +
  "\"Perfect way to spend\", \"Hidden gem\", \"Something for everyone\", \"Join us for\", \"An event is happening\"\n" +
  "- No rotating templates, canned introductions, or filler\n" +
  "- Name the venue, format, activity, or detail that makes this event distinct\n\n" +
  "Validation checklist (every event must pass before you return JSON):\n" +
  "- editorialHeadline: 12–90 chars, NOT the same words as Title\n" +
  "- editorialBody: exactly 6–10 paragraphs; every introduction must be unique; " +
  "the full article must include one memorable-idea phrase " +
  "(e.g. \"next time you\", \"easy to overlook\", a specific year, \"instead of\")\n" +
  "- Final paragraph: one quiet observation about THIS event — never \"in summary\", \"don't miss\", " +
  "\"locals love\", crowd claims, or reusable wrap-ups\n" +
  "- banditNote: one specific sentence, max 18 words\n\n" +
  "Example shape (adapt facts to the brief — never copy verbatim):\n" +
  '{"editorialHeadline":"Under the Lights at T-Mobile Park","banditNote":"The Mariners host Houston on a summer night at T-Mobile Park.","editorialBody":["...","...","Next time you pass T-Mobile Park on a game night, notice how the light spill marks an evening already underway."]}\n\n' +
  buildEditorialIntelligencePromptBlock() +
  "\n\n" +
  buildHumanDetailsPromptBlock("events") +
  "\n\n" +
  buildLastingImpressionPromptBlock("events") +
  "\n\n" +
  buildSourceConfidencePromptBlock("events");

export type GeneratedEventEditorial = {
  editorialHeadline: string | null;
  banditNote: string | null;
  editorialBody: string[] | null;
};

export function parseGeneratedEventEditorial(
  raw: unknown,
  event: Pick<LocalEvent, "name" | "venue" | "category">
): GeneratedEventEditorial {
  return diagnoseGeneratedEventEditorial(raw, event).copy;
}

export function diagnoseGeneratedEventEditorial(
  raw: unknown,
  event: Pick<LocalEvent, "name" | "venue" | "category">
): { copy: GeneratedEventEditorial; reason?: string } {
  const reject = (reason: string): { copy: GeneratedEventEditorial; reason: string } => ({
    copy: { editorialHeadline: null, banditNote: null, editorialBody: null },
    reason,
  });

  if (!raw || typeof raw !== "object") {
    return reject("invalid_row");
  }
  const row = raw as {
    editorialHeadline?: unknown;
    editorial_headline?: unknown;
    banditNote?: unknown;
    bandit_note?: unknown;
    editorialBody?: unknown;
    editorial_body?: unknown;
  };
  const rawHeadline =
    typeof row.editorialHeadline === "string"
      ? row.editorialHeadline
      : typeof row.editorial_headline === "string"
        ? row.editorial_headline
        : null;
  const rawNote =
    typeof row.banditNote === "string"
      ? row.banditNote
      : typeof row.bandit_note === "string"
        ? row.bandit_note
        : null;
  const rawBodySource = row.editorialBody ?? row.editorial_body;
  const rawBody = Array.isArray(rawBodySource)
    ? rawBodySource.filter((p): p is string => typeof p === "string")
    : [];

  if (
    containsBannedEventCopy(rawHeadline) ||
    containsBannedEventCopy(rawNote) ||
    rawBody.some((paragraph) => containsBannedEventCopy(paragraph))
  ) {
    return reject("banned_copy");
  }

  const banditNote = validateBanditNote(rawNote);
  const editorialBody = rawBody.length
    ? sanitizeEventEditorialParagraphs(rawBody)
    : null;

  const editorialHeadline = resolveEditorialHeadline(
    rawHeadline,
    event,
    editorialBody ?? [],
    banditNote
  );
  if (!editorialHeadline) return reject("headline_invalid");
  if (!banditNote) return reject("bandit_note_invalid");
  if (!editorialBody || editorialBody.length < EVENT_EDITORIAL_MIN_PARAGRAPHS) {
    return reject("body_too_short");
  }
  if (editorialBody.length > EVENT_EDITORIAL_MAX_PARAGRAPHS) {
    return reject("body_too_long");
  }

  const candidate = {
    editorialHeadline,
    banditNote,
    editorialBody: ensureLastingImpressionClosing(
      editorialBody,
      lastingImpressionClosingForEvent(
        event.name.trim(),
        event.name.trim(),
        event.category ?? null
      )
    ),
  };

  if (
    !passesEventGoldenTest({
      name: event.name,
      venue: event.venue,
      banditNote: candidate.banditNote,
      editorialBody: candidate.editorialBody,
    })
  ) {
    return reject("golden_test");
  }

  const bodyText = candidate.editorialBody.join("\n\n");
  const lastParagraph = candidate.editorialBody.at(-1) ?? "";
  const priorParagraphs = candidate.editorialBody.slice(0, -1);
  const lastingImpression = validateLastingImpressionClosing(lastParagraph, {
    priorParagraphs,
  });
  const sourceConfidence = validateSourceConfidenceBody(candidate.editorialBody, {
    desk: "events",
  });
  if (!hasMemorableTakeaway(bodyText)) return reject("no_memorable_takeaway");
  if (endingReadsLikeSummary(lastParagraph)) return reject("summary_ending");
  if (!lastingImpression.passes) return reject(`lasting_impression:${lastingImpression.reason ?? "fail"}`);
  if (!sourceConfidence.passes) return reject(`source_confidence:${sourceConfidence.reason ?? "fail"}`);

  return { copy: candidate };
}
