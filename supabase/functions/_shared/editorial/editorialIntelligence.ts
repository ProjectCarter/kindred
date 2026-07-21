/**
 * Phase 3 — Editorial Intelligence
 * Smarter articles, not longer ones. Keep in sync with lib/edition/editorialIntelligence.ts
 */

import { hasMemorableIdeaSignal } from "./memorableWriting.ts";

/** Generic AI / directory voice — never publish. */
export const GENERIC_AI_PHRASE_PATTERNS: RegExp[] = [
  /whether you('re| are) (?:a )?(?:local|visitor)/i,
  /whether you're a local or/i,
  /there('s| is) something for everyone/i,
  /\bnestled in\b/i,
  /\bhidden gem\b/i,
  /\bdon't miss\b/i,
  /\bdo not miss\b/i,
  /\bperfect for all ages\b/i,
  /\bfun for the whole family\b/i,
  /\bmust-?visit\b/i,
  /\bworth checking out\b/i,
  /\bin conclusion\b/i,
  /\bto summarize\b/i,
  /\bin summary\b/i,
  /\bat the end of the day\b/i,
  /\blook no further\b/i,
  /\bhas something for everyone\b/i,
  /\bfor all ages\b/i,
  /\bperfect for couples and families alike\b/i,
  /\bthat wraps up\b/i,
  /\bthis article (?:discussed|explored|covered)\b/i,
];

export const EDITORIAL_INTELLIGENCE_QUESTIONS =
  "Write like an experienced local journalist. When verified facts allow, naturally help the reader answer " +
  "(omit any question you cannot support — never invent):\n" +
  "• Why is this actually worth my time?\n" +
  "• What makes this different?\n" +
  "• Who would enjoy this most?\n" +
  "• When is the best time to go?\n" +
  "• What should I know before arriving?\n" +
  "• What surprises first-time visitors?\n" +
  "• What do locals know that visitors often miss?\n" +
  "• What nearby places pair well? (only if named in the brief)\n" +
  "• What time of year is best? (only from schedule/season signals)\n" +
  "• Couples, families, solo, photographers, dog owners? (only when inferable)\n" +
  "• What to bring? How long to plan? What atmosphere to expect? (reasonable inference only)\n\n" +
  "Include at least ONE memorable takeaway — a specific, useful, or delightful detail the reader " +
  "will remember an hour later (from verified facts or honest category context).\n\n" +
  "End with an observation, not a summary. Good endings feel like a quiet last look — never recap bullets.\n" +
  "Never fabricate attendance, popularity, wait times, parking, accessibility, weather, local opinions, " +
  "historical facts, wildlife, or seasonal conditions.";

export const GENERIC_AI_BANNED_LIST =
  "Permanently banned phrases: \"Whether you're a local or visitor\", \"There's something for everyone\", " +
  "\"Nestled in\", \"Hidden gem\", \"Don't miss\", \"Perfect for all ages\", \"Must-visit\", " +
  "\"In conclusion\", \"To summarize\", \"Look no further\".";

export function buildEditorialIntelligencePromptBlock(): string {
  return `${EDITORIAL_INTELLIGENCE_QUESTIONS}\n${GENERIC_AI_BANNED_LIST}`;
}

export function containsGenericAiPhrase(text: string | null | undefined): boolean {
  const raw = text?.trim();
  if (!raw) return false;
  return GENERIC_AI_PHRASE_PATTERNS.some((pattern) => pattern.test(raw));
}

export function filterGenericAiParagraphs(paragraphs: string[]): string[] {
  return paragraphs
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length >= 12 && !containsGenericAiPhrase(p));
}

export function hasMemorableTakeaway(body: string | string[]): boolean {
  const text = Array.isArray(body) ? body.filter(Boolean).join("\n\n") : body.trim();
  return hasMemorableIdeaSignal(text);
}

/** Endings that read like summaries — reject as final paragraphs. */
export const SUMMARY_ENDING_PATTERNS: RegExp[] = [
  /^in (?:short|sum|summary)\b/i,
  /^overall\b/i,
  /^all in all\b/i,
  /^to sum (?:it )?up\b/i,
  /^that wraps up\b/i,
  /^this article (?:discussed|explored|covered)\b/i,
  /^in the end,?\s+(?:this|it)\s+(?:is|offers|provides)\b/i,
];

export function endingReadsLikeSummary(paragraph: string | null | undefined): boolean {
  const trimmed = paragraph?.trim() ?? "";
  if (!trimmed) return true;
  return SUMMARY_ENDING_PATTERNS.some((pattern) => pattern.test(trimmed));
}
