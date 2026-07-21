/**
 * Local News reader helpers — pure functions safe for Node smoke tests.
 */

import type { EditorialModule } from "./contentSystem/types";
import {
  localNewsModulesFromDesk,
  readLocalNewsFieldAnswers,
  resolveLocalNewsStoryType,
} from "./localNewsStoryStructure.ts";

export const LOCAL_NEWS_DISCLAIMER_PATTERNS = [
  /\bkindred summary\b/i,
  /\bthe reporting available\b/i,
  /\bwill not invent\b/i,
  /\bread the original report\b/i,
  /\bfull report lives with\b/i,
  /\bcomplete coverage\b/i,
  /\bbrief note from\b/i,
  /\bwire note available\b/i,
  /\bverified wire note\b/i,
  /\bnot the publisher'?s full article\b/i,
  /\bnot a full account from\b/i,
  /\bsummarized from reporting\b/i,
  /\bdoes not invent details\b/i,
];

export function isLocalNewsDisclaimerParagraph(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  return LOCAL_NEWS_DISCLAIMER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function filterLocalNewsBodyParagraphs(paragraphs: string[]): string[] {
  return paragraphs
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0 && !isLocalNewsDisclaimerParagraph(p));
}

type LocalNewsDeskFourQuestions = {
  limits?: string[];
};

function readDeskFourQuestions(
  desk: Record<string, unknown> | null | undefined
): LocalNewsDeskFourQuestions {
  const raw = desk?.fourQuestions;
  if (!raw || typeof raw !== "object") return {};
  const fq = raw as Record<string, unknown>;
  return {
    limits: Array.isArray(fq.limits)
      ? fq.limits.filter((x): x is string => typeof x === "string")
      : undefined,
  };
}

/** Compose labeled desk modules from classified story_type + field_answers. */
export function localNewsModulesFromDeskMeta(
  desk: Record<string, unknown> | null | undefined
): EditorialModule[] {
  return localNewsModulesFromDesk(desk, {
    skipDisclaimer: isLocalNewsDisclaimerParagraph,
  });
}

/** @deprecated Use localNewsModulesFromDeskMeta — kept for tests migrating off flat field maps. */
export function localNewsFieldAnswersFromDesk(
  desk: Record<string, unknown> | null | undefined
): Record<string, string> {
  return readLocalNewsFieldAnswers(desk) as Record<string, string>;
}

export function localNewsStoryTypeFromDesk(
  desk: Record<string, unknown> | null | undefined
) {
  return resolveLocalNewsStoryType(desk?.storyType ?? desk?.story_type);
}

export function localNewsBriefingFooterNote(input: {
  desk?: Record<string, unknown> | null;
  source: string;
}): string | null {
  const fq = readDeskFourQuestions(input.desk);
  const limits = (fq.limits ?? []).map((l) => l.trim()).filter(Boolean);
  const publisher = input.source?.trim() || "the original publisher";

  if (limits.length) {
    return limits[0]!;
  }

  return `Source: ${publisher}. Kindred summary — read the original for the full report.`;
}
