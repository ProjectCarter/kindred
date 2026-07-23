/**
 * Kindred Article Prose — unified publication gate for every desk.
 * Composes existing editorial validators; keep prompts aligned via kindredEditorialStandards.ts.
 */

import {
  containsGenericAiPhrase,
  endingReadsLikeSummary,
  filterGenericAiParagraphs,
} from "./editorialIntelligence.ts";
import { validateLastingThought } from "./memorableWriting.ts";
import {
  extractLastParagraph,
  validateUniqueConclusion,
} from "./uniqueConclusions.ts";

/** Banned newspaper wrap-ups — never publish. */
export const NEWSPAPER_WRAP_UP_PATTERNS: RegExp[] = [
  /^in conclusion\b/i,
  /^overall\b/i,
  /^that wraps up\b/i,
  /^this article (?:discussed|explored|covered)\b/i,
  /^to summarize\b/i,
  /^in summary\b/i,
  /^all in all\b/i,
  /^as we have seen\b/i,
  /^in closing\b/i,
];

export const KINDRED_ARTICLE_CRAFT_STANDARDS = `
KINDRED ARTICLE CRAFT (every desk — professional newspaper editor, not an AI assistant):

1. STRONG HEADLINE — clear, engaging, specific; never generic or clickbait.
2. SUBHEADLINE — one sentence on why the story matters today.
3. OPENING — immediately answer what happened, why the reader should care, and why it is interesting.
4. RICH BODY — multiple well-written paragraphs; logical flow; no repetition, filler, or AI-style wording.
5. NATURAL ENDING — meaningful takeaway; never "In conclusion…", "Overall…", "That wraps up…", or recap bullets.
6. ACCURACY FIRST — verified facts only; omit anything that cannot be verified.
7. AUTHORIZED MEDIA ONLY — licensed, public domain, Creative Commons, or official source imagery with attribution.
8. EDITORIAL CONSISTENCY — calm, professional, friendly, trustworthy, local-first; one publication voice.
9. READABILITY — comfortable paragraphs; varied sentence length; no robotic patterns.
10. THE KINDRED TEST — if a first-time reader would not trust this morning's paper, revise before publishing.
`.trim();

export type KindredArticleDesk =
  | "local_news"
  | "national_news"
  | "story_of"
  | "history"
  | "history_place"
  | "event"
  | "discovery"
  | "food_drinks"
  | "bandits_pick"
  | "masterpiece";

export type KindredArticleProseInput = {
  headline: string;
  dek?: string | null;
  body: string | string[];
  subjectTokens?: string[];
  desk?: KindredArticleDesk;
  minParagraphs?: number;
  minWords?: number;
  requireDek?: boolean;
};

export type KindredArticleProseResult = {
  passes: boolean;
  reasons: string[];
};

function splitParagraphs(body: string | string[]): string[] {
  if (Array.isArray(body)) {
    return body.map((p) => p.replace(/\s+/g, " ").trim()).filter((p) => p.length >= 12);
  }
  return body
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length >= 12);
}

function wordCount(paragraphs: string[]): number {
  return paragraphs.join(" ").split(/\s+/).filter(Boolean).length;
}

function deskDefaults(desk?: KindredArticleDesk): {
  minParagraphs: number;
  minWords: number;
  requireDek: boolean;
} {
  switch (desk) {
    case "local_news":
    case "national_news":
      return { minParagraphs: 2, minWords: 40, requireDek: true };
    case "history":
    case "masterpiece":
      return { minParagraphs: 6, minWords: 380, requireDek: false };
    case "story_of":
      return { minParagraphs: 4, minWords: 200, requireDek: false };
    case "history_place":
      return { minParagraphs: 3, minWords: 120, requireDek: false };
    case "event":
      return { minParagraphs: 4, minWords: 120, requireDek: false };
    case "discovery":
    case "food_drinks":
    case "bandits_pick":
      return { minParagraphs: 3, minWords: 60, requireDek: false };
    default:
      return { minParagraphs: 2, minWords: 40, requireDek: false };
  }
}

export function endingReadsLikeNewspaperWrapUp(
  paragraph: string | null | undefined
): boolean {
  const trimmed = paragraph?.trim() ?? "";
  if (!trimmed) return true;
  if (endingReadsLikeSummary(trimmed)) return true;
  return NEWSPAPER_WRAP_UP_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/** Unified prose gate — reuse across Story Editor publish paths and composed articles. */
export function validateKindredArticleProse(
  input: KindredArticleProseInput
): KindredArticleProseResult {
  const reasons: string[] = [];
  const defaults = deskDefaults(input.desk);
  const minParagraphs = input.minParagraphs ?? defaults.minParagraphs;
  const minWords = input.minWords ?? defaults.minWords;
  const requireDek = input.requireDek ?? defaults.requireDek;
  const headline = input.headline?.trim() ?? "";
  const dek = input.dek?.trim() ?? "";
  const paragraphs = splitParagraphs(input.body);
  const blob = [headline, dek, ...paragraphs].filter(Boolean).join("\n\n");
  const subjectTokens = (input.subjectTokens ?? [headline]).filter(Boolean);

  if (!headline) reasons.push("empty_headline");
  if (requireDek && !dek) reasons.push("missing_dek");
  if (paragraphs.length < minParagraphs) {
    reasons.push(`paragraphs:${paragraphs.length}<${minParagraphs}`);
  }
  if (wordCount(paragraphs) < minWords) {
    reasons.push(`words:${wordCount(paragraphs)}<${minWords}`);
  }

  if (containsGenericAiPhrase(blob)) {
    reasons.push("generic_ai_phrase");
  }

  const last = extractLastParagraph(paragraphs);
  if (endingReadsLikeNewspaperWrapUp(last)) {
    reasons.push("summary_ending");
  }

  const unique = validateUniqueConclusion(last, { subjectTokens });
  if (!unique.passes) {
    const requireSubjectSpecificClose =
      input.desk === "history" ||
      input.desk === "masterpiece" ||
      input.desk === "story_of" ||
      input.desk === "history_place";
    if (requireSubjectSpecificClose || unique.reason !== "missing_subject") {
      reasons.push(`unique_conclusion:${unique.reason ?? "fail"}`);
    }
  }

  const lasting = validateLastingThought(paragraphs.join("\n\n"), { subjectTokens });
  if (!lasting.passes && (input.desk === "history" || input.desk === "masterpiece" || input.desk === "story_of")) {
    reasons.push(`lasting_thought:${lasting.reason ?? "fail"}`);
  }

  return { passes: reasons.length === 0, reasons };
}

export function sanitizeKindredArticleBody(
  body: string | string[]
): string[] {
  return filterGenericAiParagraphs(splitParagraphs(body));
}
