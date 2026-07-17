/**
 * Article-level validation — reject any masterpiece payload containing Wikidata syntax.
 */

import { containsWikidataSyntax } from "./sanitizeMetadata";
import type { MasterpieceDetail, MorningHeroExperience } from "./types";

/** Scan one editorial string for corrupted Wikimedia/Wikidata machine syntax. */
export function containsCorruptedArticleSyntax(
  text: string | null | undefined
): boolean {
  if (!text?.trim()) return false;
  const t = text;
  if (containsWikidataSyntax(t)) return true;
  if (/\blabel\s+QS:/i.test(t)) return true;
  if (/\btitle\s+QS:/i.test(t)) return true;
  if (/\bQS:Len\b/i.test(t)) return true;
  if (/\blabe\.{2,}/i.test(t)) return true;
  if (/\blabe…/.test(t)) return true;
  if (/\bP\d{3,}\b/.test(t)) return true;
  return false;
}

function scanStrings(values: Array<string | null | undefined>): boolean {
  return values.some((value) => containsCorruptedArticleSyntax(value));
}

/** True when structured detail sections contain any corrupted syntax. */
export function masterpieceDetailIsCorrupt(
  detail: MasterpieceDetail | null | undefined
): boolean {
  if (!detail) return false;
  const sectionStrings = (detail.sections ?? []).flatMap((section) => [
    section.heading,
    ...section.paragraphs,
  ]);
  return scanStrings([
    ...sectionStrings,
    detail.didYouKnow,
    detail.museumName,
    detail.museumLocation,
    ...(detail.lookingCloser ?? []),
    ...(detail.sourceReferences ?? []),
    detail.longStoryBody,
    detail.artistBiography,
  ]);
}

/** Scan the full morning hero article payload shown in the reader. */
export function morningHeroArticleIsCorrupt(
  hero: Pick<
    MorningHeroExperience,
    "artworkTitle" | "artist" | "aboutArtworkBody" | "creditLine" | "detail"
  >
): boolean {
  if (
    scanStrings([
      hero.artworkTitle,
      hero.artist,
      hero.aboutArtworkBody,
      hero.creditLine,
    ])
  ) {
    return true;
  }
  return masterpieceDetailIsCorrupt(hero.detail ?? null);
}

/** Returns true only when the entire article payload is safe to publish. */
export function validateMorningHeroArticle(
  hero: Pick<
    MorningHeroExperience,
    "artworkTitle" | "artist" | "aboutArtworkBody" | "creditLine" | "detail"
  >
): boolean {
  return !morningHeroArticleIsCorrupt(hero);
}

export function collectCorruptedArticleFields(
  hero: Pick<
    MorningHeroExperience,
    "artworkTitle" | "artist" | "aboutArtworkBody" | "creditLine" | "detail"
  >
): string[] {
  const corrupt: string[] = [];
  if (containsCorruptedArticleSyntax(hero.artworkTitle)) corrupt.push("artworkTitle");
  if (containsCorruptedArticleSyntax(hero.artist)) corrupt.push("artist");
  if (containsCorruptedArticleSyntax(hero.aboutArtworkBody)) corrupt.push("aboutArtworkBody");
  if (containsCorruptedArticleSyntax(hero.creditLine)) corrupt.push("creditLine");
  if (masterpieceDetailIsCorrupt(hero.detail ?? null)) corrupt.push("detail");
  return corrupt;
}
