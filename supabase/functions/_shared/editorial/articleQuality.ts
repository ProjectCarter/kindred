/**
 * Phase 2–3 — Editorial Quality Engine
 * Shared prose gates and editor questions (server-side writers).
 */

import {
  buildEditorialIntelligencePromptBlock,
  containsGenericAiPhrase,
  endingReadsLikeSummary,
  hasMemorableTakeaway,
} from "./editorialIntelligence.ts";
import { validateLastingThought } from "./memorableWriting.ts";
import { validateUniqueConclusion, extractLastParagraph } from "./uniqueConclusions.ts";

/** Phase 3 intelligence framework — smarter articles, not longer ones. */
export const EDITORIAL_QUESTIONS_FRAMEWORK = buildEditorialIntelligencePromptBlock();

export function splitBodyParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length >= 20);
}

export function countBodyParagraphs(body: string): number {
  return splitBodyParagraphs(body).length;
}

export function wordCount(body: string): number {
  return body.replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean).length;
}

export function subjectTokensFromHistory(
  year: number,
  eventText: string
): string[] {
  const tokens = [String(year)];
  const words = eventText
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 4);
  tokens.push(...words.slice(0, 4));
  return tokens;
}

export type HistoryArticleQuality = {
  passes: boolean;
  reasons: string[];
  paragraphCount: number;
  words: number;
};

export function validateHistoryArticle(
  body: string,
  year: number,
  eventText: string
): HistoryArticleQuality {
  const paragraphs = splitBodyParagraphs(body);
  const words = wordCount(body);
  const reasons: string[] = [];
  const subjectTokens = subjectTokensFromHistory(year, eventText);

  if (paragraphs.length < 6) {
    reasons.push(`paragraphs:${paragraphs.length}<6`);
  }
  if (words < 380) {
    reasons.push(`words:${words}<380`);
  }

  const lasting = validateLastingThought(body, { subjectTokens });
  if (!lasting.passes) {
    reasons.push(`lasting:${lasting.reason ?? "fail"}`);
  }

  const conclusion = validateUniqueConclusion(extractLastParagraph(body), {
    subjectTokens,
  });
  if (!conclusion.passes) {
    reasons.push(`conclusion:${conclusion.reason ?? "fail"}`);
  }

  if (containsGenericAiPhrase(body)) {
    reasons.push("generic_ai_phrase");
  }
  if (endingReadsLikeSummary(extractLastParagraph(body))) {
    reasons.push("summary_ending");
  }
  if (!hasMemorableTakeaway(body)) {
    reasons.push("no_memorable_takeaway");
  }

  return {
    passes: reasons.length === 0,
    reasons,
    paragraphCount: paragraphs.length,
    words,
  };
}
