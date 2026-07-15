/**
 * Today in History card copy — intro paragraph for the homepage card.
 */

import type { KnowledgePayload } from "./knowledge";
import { parseKnowledgePayload } from "./knowledge";

const INTRO_MIN_WORDS = 60;
const INTRO_MAX_WORDS = 120;

const YEAR_HEADLINE_RE = /^(1[0-9]{3}|20[0-9]{2})\s*[\u2014\u2013-]\s*/;

/** True when the headline already includes the year prefix (e.g. "1969 — …"). */
export function historyHeadlineIncludesYear(headline: string): boolean {
  return YEAR_HEADLINE_RE.test(headline.trim());
}

function words(text: string): string[] {
  return text.replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean);
}

/** First 80–140 words for the card intro; never cuts mid-sentence when possible. */
export function historyCardIntro(body: string): string {
  const cleaned = body.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";

  const allWords = words(cleaned);
  if (allWords.length <= INTRO_MAX_WORDS) return cleaned;

  const slice = allWords.slice(0, INTRO_MAX_WORDS).join(" ");
  const lastStop = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? ")
  );

  if (lastStop > 0 && words(slice.slice(0, lastStop + 1)).length >= INTRO_MIN_WORDS) {
    return slice.slice(0, lastStop + 1).trim();
  }

  return `${allWords.slice(0, INTRO_MAX_WORDS).join(" ")}…`;
}

/** Historical year for the homepage card — grounded in stored knowledge when possible. */
export function historyYearLabel(
  section: { headline: string; body: string },
  knowledge?: KnowledgePayload | unknown | null
): string | null {
  const payload = parseKnowledgePayload(knowledge);
  if (payload) {
    for (const packet of Object.values(payload.byStoryKey)) {
      for (const facet of packet.facets) {
        if (facet.type !== "historical_background") continue;
        const fromTitle = facet.title.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
        if (fromTitle) return fromTitle[1];
        const eventDate = facet.data?.events?.[0]?.date?.trim();
        if (eventDate && /^\d{3,4}$/.test(eventDate)) return eventDate;
      }
    }
  }

  const fromHeadline = section.headline.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  if (fromHeadline) return fromHeadline[1];

  const fromBody =
    section.body.match(/\bIn\s+(1[0-9]{3}|20[0-9]{2})\b/i) ??
    section.body.match(/\bin\s+(1[0-9]{3}|20[0-9]{2})\b/);
  if (fromBody) return fromBody[1];

  return null;
}
