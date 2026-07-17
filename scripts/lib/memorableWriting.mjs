/**
 * Lasting Thought Test for seed scripts — keep in sync with lib/edition/memorableWriting.ts
 */

import { extractLastParagraph } from "./uniqueConclusions.mjs";

export const GENERIC_LASTING_THOUGHT_PATTERNS = [
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

export const MEMORABLE_IDEA_SIGNALS = [
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
];

function findGenericLastingThoughtPattern(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return undefined;
  return GENERIC_LASTING_THOUGHT_PATTERNS.find((pattern) => pattern.test(trimmed));
}

function hasMemorableIdeaSignal(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return false;
  return MEMORABLE_IDEA_SIGNALS.some((pattern) => pattern.test(trimmed));
}

export function validateLastingThought(body, options = {}) {
  const fullText = String(body ?? "").trim();
  if (!fullText) return { passes: false, reason: "empty" };

  const genericInBody = findGenericLastingThoughtPattern(fullText);
  if (genericInBody) {
    return { passes: false, reason: "generic_takeaway", pattern: genericInBody.source };
  }

  if (!hasMemorableIdeaSignal(fullText)) {
    return { passes: false, reason: "no_memorable_idea" };
  }

  const conclusion = extractLastParagraph(fullText);
  const genericInConclusion = findGenericLastingThoughtPattern(conclusion);
  if (genericInConclusion) {
    return { passes: false, reason: "generic_takeaway", pattern: genericInConclusion.source };
  }

  const conclusionHasSignal =
    hasMemorableIdeaSignal(conclusion) ||
    (options.subjectTokens ?? []).some((token) => {
      const t = String(token).trim();
      return t.length > 3 && conclusion.toLowerCase().includes(t.toLowerCase());
    });

  if (!conclusionHasSignal) {
    return { passes: false, reason: "weak_conclusion" };
  }

  return { passes: true };
}
