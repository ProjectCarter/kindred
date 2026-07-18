/**
 * Kindred Memorable Writing — Lasting Thought Test validation.
 * Permanent editorial law: .cursor/rules/kindred-memorable-writing.mdc
 * Keep in sync with supabase/functions/_shared/editorial/memorableWriting.ts
 */

import { extractLastParagraph } from "./uniqueConclusions.ts";

/** Generic takeaways that fail the Lasting Thought Test — never publish. */
export const GENERIC_LASTING_THOUGHT_PATTERNS: RegExp[] = [
  /this remains important today/i,
  /it is worth visiting/i,
  /worth visiting\b/i,
  /continues to inspire/i,
  /this city continues to grow/i,
  /this artwork is still admired/i,
  /still admired\b/i,
  /remains an important part of/i,
  /continues to be celebrated/i,
  /a testament to/i,
  /stands as a reminder/i,
  /rich (?:in )?history/i,
  /something for everyone/i,
  /worth exploring/i,
  /must-?see (?:destination|attraction)/i,
];

/** Signals that the copy carries a concrete, memorable idea (verified facts welcome). */
export const MEMORABLE_IDEA_SIGNALS: RegExp[] = [
  /\b(1[0-9]{3}|20[0-9]{2})\b/,
  /\b\d{1,3}(?:,\d{3})+\b/,
  /\b(first|only|oldest|largest|surprising|overlooked|memorable|unexpected)\b/i,
  /\bnext time you\b/i,
  /\bremember that\b/i,
  /\beasy to overlook\b/i,
  /\bhidden in plain sight\b/i,
  /\bnotice (?:how|that|the|one|when)\b/i,
  /\blook (?:for|once more|again|closer)\b/i,
  /\binstead of\b/i,
  /\blong after\b/i,
  /\bwasn't (?:the|.*—it was|.*— it was)/i,
  /\bstill (?:surfaces|shapes|echoes|organizes|holds|carries)\b/i,
  /\bnever knew\b/i,
  /\b\d+\s+(?:gallons|miles|people|residents|blocks|years|acres|feet)\b/i,
  /\bmost locals\b/i,
  /\bmany visitors\b/i,
  /\bphotographers\b/i,
  /\bfirst-time visitors\b/i,
  /\bwildflower\b/i,
  /\bsunrise\b/i,
  /\bsunset\b/i,
  /\boverlook\b/i,
  /\bwithin walking distance\b/i,
  /\bwalking distance\b/i,
  /\bweekday mornings\b/i,
  /\bbefore \d{1,2}\s*(?:am|pm)\b/i,
];

export type LastingThoughtResult = {
  passes: boolean;
  reason?: "empty" | "generic_takeaway" | "no_memorable_idea" | "weak_conclusion";
  pattern?: string;
};

export function findGenericLastingThoughtPattern(text: string): RegExp | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  return GENERIC_LASTING_THOUGHT_PATTERNS.find((pattern) => pattern.test(trimmed));
}

export function hasMemorableIdeaSignal(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return MEMORABLE_IDEA_SIGNALS.some((pattern) => pattern.test(trimmed));
}

/**
 * Lasting Thought Test: what is the one idea the reader will remember an hour from now?
 * Requires at least one memorable signal in the full article and a non-generic conclusion.
 */
export function passesLastingThoughtTest(
  body: string | string[] | null | undefined,
  options?: { subjectTokens?: string[] }
): boolean {
  return validateLastingThought(body, options).passes;
}

export function validateLastingThought(
  body: string | string[] | null | undefined,
  options?: { subjectTokens?: string[] }
): LastingThoughtResult {
  const fullText = Array.isArray(body)
    ? body.filter(Boolean).join("\n\n")
    : String(body ?? "").trim();

  if (!fullText) return { passes: false, reason: "empty" };

  const genericInBody = findGenericLastingThoughtPattern(fullText);
  if (genericInBody) {
    return { passes: false, reason: "generic_takeaway", pattern: genericInBody.source };
  }

  if (!hasMemorableIdeaSignal(fullText)) {
    return { passes: false, reason: "no_memorable_idea" };
  }

  const conclusion = extractLastParagraph(body);
  const genericInConclusion = findGenericLastingThoughtPattern(conclusion);
  if (genericInConclusion) {
    return { passes: false, reason: "generic_takeaway", pattern: genericInConclusion.source };
  }

  const conclusionHasSignal =
    hasMemorableIdeaSignal(conclusion) ||
    (options?.subjectTokens ?? []).some((token) => {
      const t = token.trim();
      return t.length > 3 && conclusion.toLowerCase().includes(t.toLowerCase());
    });

  if (!conclusionHasSignal) {
    return { passes: false, reason: "weak_conclusion" };
  }

  return { passes: true };
}
