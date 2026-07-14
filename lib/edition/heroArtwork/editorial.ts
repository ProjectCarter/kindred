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
} {
  const trimmed = body?.trim() ?? "";
  if (!trimmed) return { valid: false, wordCount: 0 };
  const wordCount = countWords(trimmed);
  return {
    valid: wordCount >= ABOUT_ARTWORK_WORD_MIN && wordCount <= ABOUT_ARTWORK_WORD_MAX,
    wordCount,
  };
}
