/**
 * Editorial standards for Today's Masterpiece detail articles.
 * Canonical law: docs/editorial/MASTERPIECE_EDITORIAL_STANDARD.md
 * Cursor rule: .cursor/rules/kindred-masterpiece-editorial.mdc
 * All content is composed at ingest — never at app open.
 */

import { countWords } from "./editorial.ts";
import {
  extractLastParagraph,
  passesUniqueConclusionTest,
} from "../editorial/uniqueConclusions.ts";
import { passesLastingThoughtTest } from "../editorial/memorableWriting.ts";

export const LONG_STORY_PARAGRAPH_MIN = 6;
export const LONG_STORY_PARAGRAPH_MAX = 10;
export const LONG_STORY_WORD_MIN = 400;
export const LONG_STORY_WORD_MAX = 2800;

export const ARTIST_BIO_WORD_MIN = 45;
export const ARTIST_BIO_WORD_MAX = 220;

export const LOOK_CLOSER_MIN = 2;
export const LOOK_CLOSER_MAX = 4;
export const LOOK_CLOSER_WORD_MIN = 8;
export const LOOK_CLOSER_WORD_MAX = 120;

export const DID_YOU_KNOW_WORD_MIN = 12;
export const DID_YOU_KNOW_WORD_MAX = 120;

export function splitStoryParagraphs(body: string): string[] {
  return body
    .trim()
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 20);
}

export function validateLongStoryBody(body: string | null | undefined): {
  valid: boolean;
  paragraphCount: number;
  wordCount: number;
  paragraphs: string[];
  reason?: string;
} {
  const paragraphs = splitStoryParagraphs(body ?? "");
  const wordCount = countWords(paragraphs.join(" "));

  if (paragraphs.length < LONG_STORY_PARAGRAPH_MIN) {
    return {
      valid: false,
      paragraphCount: paragraphs.length,
      wordCount,
      paragraphs,
      reason: `too_few_paragraphs:${paragraphs.length}`,
    };
  }
  if (paragraphs.length > LONG_STORY_PARAGRAPH_MAX) {
    return {
      valid: false,
      paragraphCount: paragraphs.length,
      wordCount,
      paragraphs,
      reason: `too_many_paragraphs:${paragraphs.length}`,
    };
  }
  if (wordCount < LONG_STORY_WORD_MIN) {
    return {
      valid: false,
      paragraphCount: paragraphs.length,
      wordCount,
      paragraphs,
      reason: `too_short:${wordCount}`,
    };
  }
  if (wordCount > LONG_STORY_WORD_MAX) {
    return {
      valid: false,
      paragraphCount: paragraphs.length,
      wordCount,
      paragraphs,
      reason: `too_long:${wordCount}`,
    };
  }

  const lastParagraph = paragraphs.at(-1) ?? "";
  if (!passesUniqueConclusionTest(lastParagraph)) {
    return {
      valid: false,
      paragraphCount: paragraphs.length,
      wordCount,
      paragraphs,
      reason: "generic_conclusion",
    };
  }

  if (!passesLastingThoughtTest(paragraphs.join("\n\n"))) {
    return {
      valid: false,
      paragraphCount: paragraphs.length,
      wordCount,
      paragraphs,
      reason: "weak_lasting_thought",
    };
  }

  const tooShortParagraph = paragraphs.find(
    (p) => countWords(p) < 35
  );
  if (tooShortParagraph) {
    return {
      valid: false,
      paragraphCount: paragraphs.length,
      wordCount,
      paragraphs,
      reason: "thin_paragraph",
    };
  }

  return { valid: true, paragraphCount: paragraphs.length, wordCount, paragraphs };
}

export function validateArtistBiography(body: string | null | undefined): {
  valid: boolean;
  wordCount: number;
  reason?: string;
} {
  const trimmed = body?.trim() ?? "";
  const wordCount = countWords(trimmed);
  if (!trimmed) return { valid: false, wordCount: 0, reason: "missing" };
  if (wordCount < ARTIST_BIO_WORD_MIN) {
    return { valid: false, wordCount, reason: `too_short:${wordCount}` };
  }
  if (wordCount > ARTIST_BIO_WORD_MAX) {
    return { valid: false, wordCount, reason: `too_long:${wordCount}` };
  }
  return { valid: true, wordCount };
}

export function validateLookCloserItems(items: string[] | null | undefined): {
  valid: boolean;
  count: number;
  reason?: string;
} {
  const cleaned = (items ?? [])
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (cleaned.length < LOOK_CLOSER_MIN) {
    return { valid: false, count: cleaned.length, reason: "too_few_items" };
  }
  if (cleaned.length > LOOK_CLOSER_MAX) {
    return { valid: false, count: cleaned.length, reason: "too_many_items" };
  }

  for (const item of cleaned) {
    const words = countWords(item);
    if (words < LOOK_CLOSER_WORD_MIN || words > LOOK_CLOSER_WORD_MAX) {
      return { valid: false, count: cleaned.length, reason: "item_length" };
    }
    if (/^(notice|look at|compare|pay attention)/i.test(item)) {
      continue;
    }
  }

  return { valid: true, count: cleaned.length };
}

export function validateDidYouKnow(fact: string | null | undefined): {
  valid: boolean;
  wordCount: number;
  reason?: string;
} {
  const trimmed = fact?.trim() ?? "";
  const wordCount = countWords(trimmed);
  if (!trimmed) return { valid: false, wordCount: 0, reason: "missing" };
  if (wordCount < DID_YOU_KNOW_WORD_MIN) {
    return { valid: false, wordCount, reason: `too_short:${wordCount}` };
  }
  if (wordCount > DID_YOU_KNOW_WORD_MAX) {
    return { valid: false, wordCount, reason: `too_long:${wordCount}` };
  }
  return { valid: true, wordCount };
}

export type MasterpieceDetailFields = {
  longStoryBody: string | null;
  artistBiography: string | null;
  lookCloserItems: string[] | null;
  didYouKnow: string | null;
  museumName: string | null;
  museumLocation: string | null;
  officialMuseumUrl: string | null;
  officialArtworkUrl: string | null;
  sourceReferences: string[] | null;
  detailEditorialStatus: string | null;
};

export function isMasterpieceDetailComplete(
  detail: MasterpieceDetailFields
): boolean {
  if (detail.detailEditorialStatus !== "approved") return false;

  const story = validateLongStoryBody(detail.longStoryBody);
  if (!story.valid) return false;

  const bio = validateArtistBiography(detail.artistBiography);
  if (!bio.valid) return false;

  const lookCloser = validateLookCloserItems(detail.lookCloserItems);
  if (!lookCloser.valid) return false;

  const fact = validateDidYouKnow(detail.didYouKnow);
  if (!fact.valid) return false;

  if (!detail.museumName?.trim()) return false;
  if (!detail.museumLocation?.trim()) return false;

  const hasMuseumLink =
    Boolean(detail.officialMuseumUrl?.trim()) ||
    Boolean(detail.officialArtworkUrl?.trim());
  if (!hasMuseumLink) return false;

  return true;
}
