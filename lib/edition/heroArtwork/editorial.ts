export const ABOUT_ARTWORK_SENTENCE_MIN = 2;
export const ABOUT_ARTWORK_SENTENCE_MAX = 4;
export const ABOUT_ARTWORK_WORD_MIN = 35;
export const ABOUT_ARTWORK_WORD_MAX = 130;

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
} {
  const trimmed = body?.trim() ?? "";
  if (!trimmed) return { valid: false, wordCount: 0, sentenceCount: 0 };
  const wordCount = countWords(trimmed);
  const sentenceCount = countSentences(trimmed);
  return {
    valid:
      sentenceCount >= ABOUT_ARTWORK_SENTENCE_MIN &&
      sentenceCount <= ABOUT_ARTWORK_SENTENCE_MAX &&
      wordCount >= ABOUT_ARTWORK_WORD_MIN &&
      wordCount <= ABOUT_ARTWORK_WORD_MAX,
    wordCount,
    sentenceCount,
  };
}
