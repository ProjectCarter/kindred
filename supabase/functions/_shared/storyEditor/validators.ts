/**
 * Deterministic Story Editor validators — models propose; validators dispose.
 */

import { isPlaceholderCopy } from "../contentQuality.ts";
import type { StoryEditorScores, StorySurfaceRole } from "./types.ts";
import { STORY_EDITOR_SCORE_KEYS } from "./types.ts";

const AI_TELLS =
  /\b(in conclusion|it is important to note|moreover|furthermore|delve|landscape|robust|tapestry|leverage|utilize|in today's world|at the end of the day)\b/i;

const PRESS_RELEASE =
  /\b(is excited to announce|committed to excellence|synerg|pleased to announce|game-?changer|disrupting the industry)\b/i;

const SENSATIONAL =
  /\b(shocking|explosive|slams|destroyed|goes viral|you won't believe|jaw-dropping|bombshell)\b/i;

const PROCEDURAL_OPEN =
  /^(in a (recent|new|official)|according to (a |the )?(report|statement|press)|on (monday|tuesday|wednesday|thursday|friday|saturday|sunday)|as of|officials (said|announced))/i;

const CTA_END =
  /\b(read (the )?full (story|article)|click here|subscribe|follow us|for more(,| ))\b/i;

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

export type ValidationIssue = {
  code: string;
  message: string;
};

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

  if (
    input.surfaceRole === "local_news" &&
    isRichLocalNewsSource(input.sourceText)
  ) {
    if (input.paragraphs.length < 4) {
      issues.push({
        code: "briefing_too_short",
        message:
          "Local News briefing should be 4–8 paragraphs when the source supports it.",
      });
    }
    if (input.paragraphs.length > 8) {
      issues.push({
        code: "briefing_too_long",
        message: "Local News briefing exceeds eight paragraphs.",
      });
    }
  }

  if (
    input.surfaceRole === "local_news" &&
    isThinSource(input.sourceText) &&
    input.paragraphs.length > 3
  ) {
    issues.push({
      code: "thin_source_padded",
      message: "Thin wire padded beyond an honest Local News briefing.",
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

  return issues;
}

export function allScoresAreFive(scores: StoryEditorScores): boolean {
  return STORY_EDITOR_SCORE_KEYS.every((k) => scores[k] === 5);
}

export function averageScore(scores: StoryEditorScores): number {
  const sum = STORY_EDITOR_SCORE_KEYS.reduce((n, k) => n + scores[k], 0);
  return sum / STORY_EDITOR_SCORE_KEYS.length;
}
