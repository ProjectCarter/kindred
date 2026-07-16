/**
 * Kindred Unique Conclusions — Swap Test validation.
 * Permanent editorial law: .cursor/rules/kindred-unique-conclusions.mdc
 * Keep in sync with supabase/functions/_shared/editorial/uniqueConclusions.ts
 */

/** Reusable closings that fail the Swap Test — never publish. */
export const GENERIC_CONCLUSION_PATTERNS: RegExp[] = [
  /kindred keeps these anniversaries/i,
  /explains how we got here/i,
  /see you tomorrow/i,
  /i'?ll keep looking/i,
  /glad you didn'?t miss this one/i,
  /some things are only beautiful because they don'?t last/i,
  /let today'?s masterpiece slow the morning/i,
  /slow the morning by a minute/i,
  /return to it when you can — and until then/i,
  /worth stepping out for/i,
  /don'?t miss this one/i,
  /mark your calendar/i,
  /gather your friends/i,
  /show up with curiosity/i,
  /perfect way to spend/i,
  /could describe any/i,
  /history still matters\b/i,
  /connect the past with the present/i,
  /a calm minute of context before the rest of the day/i,
  /before the rest of the day pulls you forward/i,
  /more verified background may arrive in later editions/i,
];

export type UniqueConclusionResult = {
  passes: boolean;
  reason?: "empty" | "generic_pattern" | "missing_subject";
  pattern?: string;
};

export function extractLastParagraph(body: string | string[] | null | undefined): string {
  if (Array.isArray(body)) {
    const last = [...body].reverse().find((p) => p?.trim());
    return last?.trim() ?? "";
  }
  const paragraphs = String(body ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return paragraphs.at(-1) ?? "";
}

export function findGenericConclusionPattern(text: string): RegExp | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  return GENERIC_CONCLUSION_PATTERNS.find((pattern) => pattern.test(trimmed));
}

/**
 * Swap Test: if this paragraph were pasted into another article, would anyone notice?
 * Optional subjectTokens require at least one identifiable token in the conclusion.
 */
export function passesUniqueConclusionTest(
  paragraph: string | null | undefined,
  options?: { subjectTokens?: string[] }
): boolean {
  return validateUniqueConclusion(paragraph, options).passes;
}

export function validateUniqueConclusion(
  paragraph: string | null | undefined,
  options?: { subjectTokens?: string[] }
): UniqueConclusionResult {
  const trimmed = paragraph?.trim() ?? "";
  if (!trimmed) return { passes: false, reason: "empty" };

  const pattern = findGenericConclusionPattern(trimmed);
  if (pattern) {
    return { passes: false, reason: "generic_pattern", pattern: pattern.source };
  }

  const tokens = (options?.subjectTokens ?? []).filter((t) => t.trim().length > 3);
  if (tokens.length) {
    const hay = trimmed.toLowerCase();
    const hasSubject = tokens.some((token) => hay.includes(token.toLowerCase()));
    if (!hasSubject) return { passes: false, reason: "missing_subject" };
  }

  return { passes: true };
}
