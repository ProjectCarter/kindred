/**
 * Phase 3 — Editorial Intelligence (client mirror)
 * Keep in sync with supabase/functions/_shared/editorial/editorialIntelligence.ts
 */

import { hasMemorableIdeaSignal } from "./memorableWriting";

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
];

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

export const SUMMARY_ENDING_PATTERNS: RegExp[] = [
  /^in (?:short|sum|summary)\b/i,
  /^overall\b/i,
  /^all in all\b/i,
  /^to sum (?:it )?up\b/i,
  /^in the end,?\s+(?:this|it)\s+(?:is|offers|provides)\b/i,
];

export function endingReadsLikeSummary(paragraph: string | null | undefined): boolean {
  const trimmed = paragraph?.trim() ?? "";
  if (!trimmed) return true;
  return SUMMARY_ENDING_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

const PLACE_CLOSING_OBSERVATIONS = [
  "This is the kind of place that quietly becomes part of someone's weekend routine.",
  "The best discoveries are usually the ones you weren't planning to make.",
  "If you're looking for one peaceful stop this week, this is an easy place to begin.",
  "Long after you leave, it's often the small detail you noticed first that stays with you.",
  "Most worthwhile local stops reward the visit that happens sooner rather than later.",
];

const EVENT_CLOSING_OBSERVATIONS = [
  "Long after the event ends, it's often the conversations afterward that people remember.",
  "The evening tends to linger in memory longer than the drive home.",
  "This is the sort of plan that reads small on paper and feels larger once you're there.",
];

/** Stable observation ending — not a summary, not generic AI. */
export function observationClosingForPlace(title: string, seed: string): string {
  const idx = hashString(`${seed}:${title}`) % PLACE_CLOSING_OBSERVATIONS.length;
  return PLACE_CLOSING_OBSERVATIONS[idx]!;
}

export function observationClosingForEvent(title: string, seed: string): string {
  const idx = hashString(`${seed}:${title}`) % EVENT_CLOSING_OBSERVATIONS.length;
  return EVENT_CLOSING_OBSERVATIONS[idx]!;
}
