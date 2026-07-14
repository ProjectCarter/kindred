/**
 * Editorial standards for "About Today's Artwork" — timeless, educational, never marketing.
 */

export const ABOUT_ARTWORK_WORD_MIN = 80;
export const ABOUT_ARTWORK_WORD_MAX = 150;

export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function validateAboutArtworkBody(body: string | null | undefined): {
  valid: boolean;
  wordCount: number;
  reason?: string;
} {
  const trimmed = body?.trim() ?? "";
  if (!trimmed) {
    return { valid: false, wordCount: 0, reason: "missing" };
  }

  const wordCount = countWords(trimmed);
  if (wordCount < ABOUT_ARTWORK_WORD_MIN) {
    return {
      valid: false,
      wordCount,
      reason: `too_short:${wordCount}`,
    };
  }
  if (wordCount > ABOUT_ARTWORK_WORD_MAX) {
    return {
      valid: false,
      wordCount,
      reason: `too_long:${wordCount}`,
    };
  }

  // Guard against marketing tone and encyclopedia pastiche — light heuristics only.
  if (/\b(buy now|limited time|don't miss|click here|best deal)\b/i.test(trimmed)) {
    return { valid: false, wordCount, reason: "marketing_tone" };
  }
  if (/\baccording to wikipedia\b/i.test(trimmed)) {
    return { valid: false, wordCount, reason: "encyclopedia_pastiche" };
  }

  return { valid: true, wordCount };
}

export type AboutArtworkGuidelines = {
  /** Who created it — name, period, medium when known. */
  who: string;
  /** Why it matters in art history. */
  historicalImportance: string;
  /** Why it became famous or widely recognized. */
  fame: string;
  /** One interesting contextual detail — era, patron, technique, reception. */
  context: string;
};

/**
 * Structure for curator-authored or future editorial generation.
 * Does not generate copy — defines the shape of excellent "About" writing.
 */
export function aboutArtworkOutline(guidelines: AboutArtworkGuidelines): string[] {
  return [
    guidelines.who,
    guidelines.historicalImportance,
    guidelines.fame,
    guidelines.context,
  ];
}
