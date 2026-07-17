/**
 * Homepage teaser for Today's Masterpiece — 1–2 curiosity-driven sentences.
 */

export const ABOUT_ARTWORK_SENTENCE_MIN = 1;
export const ABOUT_ARTWORK_SENTENCE_MAX = 2;
export const ABOUT_ARTWORK_WORD_MIN = 35;
export const ABOUT_ARTWORK_WORD_MAX = 60;

export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function countSentences(text: string): number {
  return text
    .trim()
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8).length;
}

export function validateAboutArtworkBody(body: string | null | undefined): {
  valid: boolean;
  wordCount: number;
  sentenceCount: number;
  reason?: string;
} {
  const trimmed = body?.trim() ?? "";
  if (!trimmed) {
    return { valid: false, wordCount: 0, sentenceCount: 0, reason: "missing" };
  }

  const wordCount = countWords(trimmed);
  const sentenceCount = countSentences(trimmed);

  if (sentenceCount < ABOUT_ARTWORK_SENTENCE_MIN) {
    return {
      valid: false,
      wordCount,
      sentenceCount,
      reason: `too_few_sentences:${sentenceCount}`,
    };
  }
  if (sentenceCount > ABOUT_ARTWORK_SENTENCE_MAX) {
    return {
      valid: false,
      wordCount,
      sentenceCount,
      reason: `too_many_sentences:${sentenceCount}`,
    };
  }
  if (wordCount < ABOUT_ARTWORK_WORD_MIN) {
    return {
      valid: false,
      wordCount,
      sentenceCount,
      reason: `too_short:${wordCount}`,
    };
  }
  if (wordCount > ABOUT_ARTWORK_WORD_MAX) {
    return {
      valid: false,
      wordCount,
      sentenceCount,
      reason: `too_long:${wordCount}`,
    };
  }

  if (/\b(buy now|limited time|don't miss|click here|best deal)\b/i.test(trimmed)) {
    return { valid: false, wordCount, sentenceCount, reason: "marketing_tone" };
  }
  if (/\baccording to wikipedia\b/i.test(trimmed)) {
    return {
      valid: false,
      wordCount,
      sentenceCount,
      reason: "encyclopedia_pastiche",
    };
  }

  return { valid: true, wordCount, sentenceCount };
}

/** Library ingest may store long bodies — homepage trims to 1–2 sentences at display. */
export function hasLibraryAboutArtworkBody(
  body: string | null | undefined
): boolean {
  const trimmed = body?.trim() ?? "";
  if (!trimmed) return false;
  return countWords(trimmed) >= ABOUT_ARTWORK_WORD_MIN;
}

export type AboutArtworkGuidelines = {
  who: string;
  historicalImportance: string;
  fame: string;
  context: string;
};

export function aboutArtworkOutline(guidelines: AboutArtworkGuidelines): string[] {
  return [
    guidelines.who,
    guidelines.historicalImportance,
    guidelines.fame,
    guidelines.context,
  ];
}
