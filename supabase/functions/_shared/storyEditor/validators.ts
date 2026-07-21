/**
 * Deterministic Story Editor validators — models propose; validators dispose.
 */

import { isPlaceholderCopy } from "../contentQuality.ts";
import {
  containsGenericAiPhrase,
  endingReadsLikeSummary,
} from "../editorial/editorialIntelligence.ts";
import {
  extractLastParagraph,
  validateUniqueConclusion,
} from "../editorial/uniqueConclusions.ts";
import {
  detectEditorialRedundancy,
  proseNearDuplicate,
} from "../../../../lib/edition/editorialRedundancy.ts";
export { proseNearDuplicate } from "../../../../lib/edition/editorialRedundancy.ts";
import type { StoryEditorScores, StorySurfaceRole } from "./types.ts";
import { STORY_EDITOR_SCORE_KEYS } from "./types.ts";

const AI_TELLS =
  /\b(in conclusion|it is important to note|moreover|furthermore|delve|landscape|robust|tapestry|leverage|utilize|in today's world|at the end of the day|that wraps up|this article (?:discussed|explored|covered))\b/i;

const PRESS_RELEASE =
  /\b(is excited to announce|committed to excellence|synerg|pleased to announce|game-?changer|disrupting the industry)\b/i;

const SENSATIONAL =
  /\b(shocking|explosive|slams|destroyed|goes viral|you won't believe|jaw-dropping|bombshell)\b/i;

const PROCEDURAL_OPEN =
  /^(in a (recent|new|official)|according to (a |the )?(report|statement|press)|on (monday|tuesday|wednesday|thursday|friday|saturday|sunday)|as of|officials (said|announced))/i;

const CTA_END =
  /\b(read (the )?full (story|article)|click here|subscribe|follow us|for more(,| ))\b/i;

const LOCAL_NEWS_DISCLAIMER_IN_BODY =
  /\b(kindred summary|the reporting available|will not invent|read the original report|full report lives with|complete coverage|brief note from|not a full account from)\b/i;

/** Definitive future / outcome language — allowed only when in source or clearly hedged. */
const FUTURE_AS_FACT =
  /\b(will (?:win|lose|pass|fail|open|close|sign|announce|be|become)|is (?:certain|guaranteed) to|has been decided|already won|already lost)\b/i;

const LOOKING_AHEAD_HEDGE =
  /\b(watch for|expect updates|remains to be seen|may|might|could|likely|if approved|pending|still to come|readers should follow|what to watch|scheduled for|is expected to|officials say|according to)\b/i;

const ATTRIBUTED_SPEECH =
  /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\s+(?:said|stated|told|remarked|noted|claimed|argued|insisted)\b/;

export function extractQuotedPassages(text: string): string[] {
  const matches = text.match(/"([^"]{6,})"/g) ?? [];
  return matches.map((q) => q.slice(1, -1).trim());
}

export function quoteSubstantivelyInSource(
  quote: string,
  sourceText: string
): boolean {
  const norm = normalizeForContainment(quote);
  const src = normalizeForContainment(sourceText);
  if (!norm || norm.length < 6) return true;
  const sig = norm.slice(0, Math.min(48, norm.length));
  return src.includes(sig);
}

export function fabricatedQuotes(
  draft: string,
  sourceText: string
): string[] {
  const quotes = extractQuotedPassages(draft);
  if (!quotes.length) return [];
  return quotes.filter((q) => !quoteSubstantivelyInSource(q, sourceText));
}

export function unsupportedAttributedSpeech(
  draft: string,
  sourceText: string
): boolean {
  if (!ATTRIBUTED_SPEECH.test(draft)) return false;
  if (ATTRIBUTED_SPEECH.test(sourceText)) return false;
  return true;
}

export function lookingAheadNeedsHedge(
  text: string,
  sourceText: string
): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (quoteSubstantivelyInSource(trimmed, sourceText)) return false;
  if (LOOKING_AHEAD_HEDGE.test(trimmed)) return false;
  if (FUTURE_AS_FACT.test(trimmed)) return true;
  return false;
}

const ENGLISH_IDIOM =
  /\b(hit the ground running|move the needle|low-hanging fruit|at the end of the day|think outside the box|game changer)\b/i;

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function normalizeForContainment(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.%$]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract numbers / money / percents for fact locking. */
export function extractNumberTokens(text: string): string[] {
  const matches = text.match(
    /(?:\$\s?)?\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?%?|\$\s?\d+(?:\.\d+)?/g
  );
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.replace(/\s+/g, "")))];
}

export function unsupportedNumbers(
  draft: string,
  source: string
): string[] {
  const sourceNorm = normalizeForContainment(source);
  const bad: string[] = [];
  for (const token of extractNumberTokens(draft)) {
    const bare = token.replace(/[$,]/g, "");
    if (bare.length <= 1) continue;
    // Years often appear only in publishedAt — allow 19xx/20xx if in source or draft context thin
    if (/^(19|20)\d{2}$/.test(bare) && sourceNorm.includes(bare)) continue;
    const variants = [
      token.toLowerCase(),
      bare,
      token.replace(/,/g, "").toLowerCase(),
    ];
    const ok = variants.some((v) => sourceNorm.includes(v.toLowerCase()));
    if (!ok) bad.push(token);
  }
  return bad;
}

export function isThinSource(sourceText: string): boolean {
  return wordCount(sourceText) < 40;
}

/** Rich wire notes can support a full Local News briefing. */
export function isRichLocalNewsSource(sourceText: string): boolean {
  return wordCount(sourceText) >= 80;
}

export type LocalNewsFieldAnswers = {
  why_it_matters?: string;
  background?: string;
  looking_ahead?: string;
  verified_facts?: string;
  economic_impact?: string;
};

const LOCAL_NEWS_SECTION_KEYS = [
  "why_it_matters",
  "background",
  "looking_ahead",
  "verified_facts",
  "economic_impact",
] as const;

function populatedLocalNewsSections(
  fieldAnswers?: LocalNewsFieldAnswers | null
): number {
  if (!fieldAnswers) return 0;
  let count = 0;
  for (const key of LOCAL_NEWS_SECTION_KEYS) {
    const text = fieldAnswers[key]?.trim();
    if (text && text.length >= 12 && !LOCAL_NEWS_DISCLAIMER_IN_BODY.test(text)) {
      count += 1;
    }
  }
  return count;
}

export type ValidationIssue = {
  code: string;
  message: string;
};

/** Hard rejects — fabrication, unsupported facts, or disclaimer violations. */
export const FACT_INTEGRITY_ISSUE_CODES = [
  "unsupported_numbers",
  "placeholder",
  "sensational",
  "press_release",
  "disclaimer_in_body",
  "disclaimer_in_sections",
  "fabricated_quote",
  "fabricated_quote_in_section",
  "unsupported_attribution",
  "unsupported_attribution_in_section",
  "future_presented_as_fact",
] as const;

export function isFactIntegrityIssue(code: string): boolean {
  return (FACT_INTEGRITY_ISSUE_CODES as readonly string[]).includes(code);
}

export function validateStoryDraft(input: {
  headline: string;
  dek: string | null;
  paragraphs: string[];
  sourceText: string;
  scores: StoryEditorScores;
  voluntaryFinish: boolean;
  memorableInsight: string | null;
  requirePerfectScores: boolean;
  surfaceRole?: StorySurfaceRole;
  fieldAnswers?: LocalNewsFieldAnswers | null;
  storyType?: string | null;
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const body = input.paragraphs.join("\n\n");
  const blob = `${input.headline}\n${input.dek ?? ""}\n${body}`;

  if (!input.paragraphs.length) {
    issues.push({ code: "empty_body", message: "No paragraphs." });
  }
  if (!input.headline.trim()) {
    issues.push({ code: "empty_headline", message: "Missing headline." });
  }
  if (isPlaceholderCopy(blob)) {
    issues.push({
      code: "placeholder",
      message: "Placeholder / template copy detected.",
    });
  }
  if (AI_TELLS.test(blob)) {
    issues.push({ code: "ai_tells", message: "AI filler language detected." });
  }
  if (PRESS_RELEASE.test(blob)) {
    issues.push({
      code: "press_release",
      message: "Press-release diction detected.",
    });
  }
  if (SENSATIONAL.test(blob)) {
    issues.push({
      code: "sensational",
      message: "Sensational language detected.",
    });
  }
  if (ENGLISH_IDIOM.test(blob)) {
    issues.push({
      code: "untranslatable_idiom",
      message: "English idiom that travels poorly.",
    });
  }
  if (input.paragraphs[0] && PROCEDURAL_OPEN.test(input.paragraphs[0].trim())) {
    issues.push({
      code: "procedural_open",
      message: "Opening is procedural / bureaucratic.",
    });
  }
  const last = input.paragraphs[input.paragraphs.length - 1] ?? "";
  if (CTA_END.test(last)) {
    issues.push({
      code: "cta_ending",
      message: "Ending reads like a CTA.",
    });
  }

  const badNums = unsupportedNumbers(blob, input.sourceText);
  if (badNums.length) {
    issues.push({
      code: "unsupported_numbers",
      message: `Numbers not in source: ${badNums.slice(0, 5).join(", ")}`,
    });
  }

  const badQuotes = fabricatedQuotes(blob, input.sourceText);
  if (badQuotes.length) {
    issues.push({
      code: "fabricated_quote",
      message: `Quoted speech not in source: "${badQuotes[0].slice(0, 60)}…"`,
    });
  }

  if (unsupportedAttributedSpeech(blob, input.sourceText)) {
    issues.push({
      code: "unsupported_attribution",
      message:
        "Attributed speech or opinion not in source — newspapers do not invent quotes.",
    });
  }

  for (const text of Object.values(input.fieldAnswers ?? {})) {
    if (typeof text !== "string" || !text.trim()) continue;
    const sectionQuotes = fabricatedQuotes(text, input.sourceText);
    if (sectionQuotes.length) {
      issues.push({
        code: "fabricated_quote_in_section",
        message: "field_answers contains quotes not supported by the source.",
      });
      break;
    }
    if (unsupportedAttributedSpeech(text, input.sourceText)) {
      issues.push({
        code: "unsupported_attribution_in_section",
        message: "field_answers attributes speech not in the source.",
      });
      break;
    }
  }

  const lookingAhead = input.fieldAnswers?.looking_ahead?.trim();
  if (
    lookingAhead &&
    lookingAheadNeedsHedge(lookingAhead, input.sourceText)
  ) {
    issues.push({
      code: "future_presented_as_fact",
      message:
        "looking_ahead must hedge forward context — never state unverified outcomes as fact.",
    });
  }

  if (input.paragraphs.some((p) => LOCAL_NEWS_DISCLAIMER_IN_BODY.test(p))) {
    issues.push({
      code: "disclaimer_in_body",
      message:
        "Attribution or disclaimer language belongs in four_questions.limits, not the body.",
    });
  }

  const open = input.paragraphs[0]?.trim() ?? "";
  const headline = input.headline.trim();

  if (open && headline && proseNearDuplicate(open, headline)) {
    issues.push({
      code: "headline_repeats_in_open",
      message:
        "Opening paragraph repeats the headline — lead with the news instead.",
    });
  }

  if (
    input.dek?.trim() &&
    headline &&
    proseNearDuplicate(input.dek, headline)
  ) {
    issues.push({
      code: "dek_repeats_headline",
      message: "Dek repeats the headline.",
    });
  }

  if (input.surfaceRole === "local_news") {
    if (
      isThinSource(input.sourceText) &&
      open &&
      proseNearDuplicate(open, input.sourceText)
    ) {
      issues.push({
        code: "wire_repeated_in_open",
        message:
          "Thin wire paraphrased in the opening — add verified context instead of repeating the note.",
      });
    }

    if (input.paragraphs.length > 4) {
      issues.push({
        code: "lead_too_long",
        message: "Lead exceeds four paragraphs — move context into field_answers.",
      });
    }

    if (!input.storyType?.trim()) {
      issues.push({
        code: "missing_story_type",
        message: "Classify the story with story_type before writing.",
      });
    }

    const contextSections = populatedLocalNewsSections(input.fieldAnswers);
    if (contextSections === 0) {
      issues.push({
        code: "missing_context",
        message:
          "Add at least one field_answers section so readers understand why the story matters.",
      });
    }

    for (const text of Object.values(input.fieldAnswers ?? {})) {
      if (typeof text === "string" && LOCAL_NEWS_DISCLAIMER_IN_BODY.test(text)) {
        issues.push({
          code: "disclaimer_in_sections",
          message: "Disclaimer language belongs in four_questions.limits only.",
        });
        break;
      }
    }

    const combined = [body, ...Object.values(input.fieldAnswers ?? {})]
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .join("\n\n");
    if (
      isThinSource(input.sourceText) &&
      combined &&
      proseNearDuplicate(combined, input.sourceText) &&
      contextSections === 0
    ) {
      issues.push({
        code: "thin_source_padded",
        message: "Thin wire repeated without adding verified context.",
      });
    }
  }

  // Headline surplus: body should not be a near-clone of the wire description alone
  // when source was rich — checked softly via length when not thin.
  if (
    !isThinSource(input.sourceText) &&
    input.paragraphs.length === 1 &&
    wordCount(body) < 60
  ) {
    issues.push({
      code: "too_thin_for_source",
      message: "Source supported more understanding than this draft delivers.",
    });
  }

  if (input.dek) {
    const d = normalizeForContainment(input.dek);
    const p1 = normalizeForContainment(input.paragraphs[0] ?? "");
    if (d && p1 && (d === p1 || p1.includes(d) || d.includes(p1))) {
      issues.push({
        code: "dek_body_clone",
        message: "Dek duplicates opening paragraph.",
      });
    }
  }

  if (!input.voluntaryFinish) {
    issues.push({
      code: "voluntary_finish",
      message: "Editor would not voluntarily finish.",
    });
  }

  if (!input.memorableInsight?.trim()) {
    issues.push({
      code: "no_insight",
      message: "Missing memorable insight note.",
    });
  }

  for (const key of STORY_EDITOR_SCORE_KEYS) {
    const v = input.scores[key];
    if (typeof v !== "number" || v < 0 || v > 5) {
      issues.push({ code: "bad_score", message: `Invalid score: ${key}` });
      continue;
    }
    if (input.requirePerfectScores && v < 5) {
      issues.push({
        code: "score_below_five",
        message: `${key} is ${v}/5 — requires 5.`,
      });
    }
  }

  if (containsGenericAiPhrase(blob)) {
    issues.push({
      code: "generic_ai_phrase",
      message: "Generic AI / template phrasing detected.",
    });
  }

  const lastParagraph = extractLastParagraph(input.paragraphs);
  if (endingReadsLikeSummary(lastParagraph)) {
    issues.push({
      code: "summary_ending",
      message: "Ending reads like a summary wrap-up.",
    });
  }

  const unique = validateUniqueConclusion(lastParagraph, {
    subjectTokens: headline.split(/\s+/).filter((w) => w.length > 3).slice(0, 4),
  });
  if (!unique.passes) {
    issues.push({
      code: "generic_conclusion",
      message: `Swap Test failed: ${unique.reason ?? "generic"}.`,
    });
  }

  const redundancy = detectEditorialRedundancy({
    headline: input.headline,
    dek: input.dek,
    paragraphs: input.paragraphs,
  });
  for (const reason of redundancy.reasons) {
    issues.push({
      code: "editorial_redundancy",
      message: reason,
    });
  }

  return issues;
}

/** Shape-only acceptance for thin Local News drafts — fact integrity checked separately. */
export function validateLocalNewsThinAcceptance(input: {
  headline: string;
  dek: string | null;
  paragraphs: string[];
  sourceText: string;
  fieldAnswers?: LocalNewsFieldAnswers | null;
  storyType?: string | null;
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const headline = input.headline.trim();
  const open = input.paragraphs[0]?.trim() ?? "";
  const body = input.paragraphs.join("\n\n");
  const contextSections = populatedLocalNewsSections(input.fieldAnswers);

  if (!input.paragraphs.length) {
    issues.push({ code: "empty_body", message: "No paragraphs." });
  }
  if (!input.storyType?.trim()) {
    issues.push({
      code: "missing_story_type",
      message: "Classify the story with story_type before writing.",
    });
  }
  if (!input.dek?.trim()) {
    issues.push({
      code: "missing_dek",
      message: "Thin Local News requires a distinct dek.",
    });
  }
  if (open && headline && proseNearDuplicate(open, headline)) {
    issues.push({
      code: "headline_repeats_in_open",
      message:
        "Opening paragraph repeats the headline — lead with the news instead.",
    });
  }
  if (input.dek?.trim() && headline && proseNearDuplicate(input.dek, headline)) {
    issues.push({
      code: "dek_repeats_headline",
      message: "Dek repeats the headline.",
    });
  }
  if (input.dek?.trim() && open && proseNearDuplicate(input.dek, open)) {
    issues.push({
      code: "dek_body_clone",
      message: "Dek duplicates opening paragraph.",
    });
  }
  if (body && headline && proseNearDuplicate(body, headline)) {
    issues.push({
      code: "body_repeats_headline",
      message: "Body repeats the headline without verified substance.",
    });
  }
  if (contextSections === 0 && isThinSource(input.sourceText)) {
    issues.push({
      code: "missing_context",
      message:
        "Add at least one field_answers section so readers understand why the story matters.",
    });
  }
  if (input.paragraphs.length > 4) {
    issues.push({
      code: "lead_too_long",
      message: "Lead exceeds four paragraphs — move context into field_answers.",
    });
  }
  return issues;
}

export function canAcceptLocalNewsThinDraft(input: {
  headline: string;
  dek: string | null;
  paragraphs: string[];
  sourceText: string;
  scores: StoryEditorScores;
  voluntaryFinish: boolean;
  memorableInsight: string | null;
  fieldAnswers?: LocalNewsFieldAnswers | null;
  storyType?: string | null;
}): { accepted: boolean; issues: ValidationIssue[]; factIssues: ValidationIssue[] } {
  const allIssues = validateStoryDraft({
    ...input,
    requirePerfectScores: false,
    surfaceRole: "local_news",
  });
  const factIssues = allIssues.filter((i) => isFactIntegrityIssue(i.code));
  const shapeIssues = validateLocalNewsThinAcceptance(input);
  const blockingShape = shapeIssues.filter(
    (i) =>
      i.code !== "missing_context" ||
      populatedLocalNewsSections(input.fieldAnswers) === 0
  );
  return {
    accepted: !factIssues.length && !blockingShape.length,
    issues: [...factIssues, ...blockingShape],
    factIssues,
  };
}

export function allScoresAreFive(scores: StoryEditorScores): boolean {
  return STORY_EDITOR_SCORE_KEYS.every((k) => scores[k] === 5);
}

export function averageScore(scores: StoryEditorScores): number {
  const sum = STORY_EDITOR_SCORE_KEYS.reduce((n, k) => n + scores[k], 0);
  return sum / STORY_EDITOR_SCORE_KEYS.length;
}
