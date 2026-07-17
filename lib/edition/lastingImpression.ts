/**
 * Phase 7 — Lasting Impression Engine (client mirror)
 * Keep in sync with supabase/functions/_shared/editorial/lastingImpression.ts
 */

import { endingReadsLikeSummary } from "./editorialIntelligence";
import { containsGenericPlaceObservation } from "./humanDetails";
import {
  findGenericLastingThoughtPattern,
  hasMemorableIdeaSignal,
} from "./memorableWriting";
import {
  findGenericConclusionPattern,
  validateUniqueConclusion,
} from "./uniqueConclusions";

export type LastingImpressionDesk =
  | "events"
  | "activities"
  | "recommendations"
  | "bandits_pick"
  | "history";

export const PROMOTIONAL_CLOSING_PATTERNS: RegExp[] = [
  /\bcheck it out\b/i,
  /\bperfect for everyone\b/i,
  /\bwhether you('re| are) (?:a )?local or visit/i,
  /\bdon'?t miss it\b/i,
  /\bdon'?t miss this\b/i,
  /\ba great place to spend the day\b/i,
  /\bgreat place to spend (?:the )?day\b/i,
  /\bworth checking out\b/i,
  /\bhighly recommend\b/i,
  /\byou won'?t regret\b/i,
  /\bcome see for yourself\b/i,
  /\bplan your visit\b/i,
  /\badd it to your list\b/i,
  /\bsee you there\b/i,
  /\bgo check it out\b/i,
  /\bmake sure to visit\b/i,
  /\bput (?:this|it) on your (?:list|calendar)\b/i,
  /\bfun for the whole family\b/i,
  /\bsomething for everyone\b/i,
];

export const LASTING_IMPRESSION_EXAMPLES: readonly string[] = [
  "The scenery changes with the seasons, but the feeling of slowing down here rarely does.",
  "Most visitors remember the destination. Locals often remember the walk getting there.",
  "Every community has places that quietly become part of people's routines. This is one of them.",
  "Some experiences are exciting because they're rare. Others become meaningful because people return to them again and again.",
  "The best discoveries are often the ones that never needed a headline.",
  "Long after you leave, it's often the small detail you noticed first that stays with you.",
  "This is the kind of place that quietly becomes part of someone's weekend routine.",
  "The season shifts what people come for — worth noticing on each visit.",
  "Most worthwhile local stops reward the visit that happens sooner rather than later.",
  "Regulars tend to find a preferred hour and protect it.",
  "The view — or the room — is often earned, not handed to you.",
  "Morning is when this place quietly shines.",
];

const DESK_GUIDANCE: Record<LastingImpressionDesk, string> = {
  events:
    "Events desk: end with one quiet observation about timing, atmosphere, or what lingers after — " +
    "never a recap, never 'don't miss,' never a calendar push. Tie the closing to THIS event when the brief allows.",
  activities:
    "Activities desk: close on pacing, memory, or why people return — not a sales line. " +
    "The last sentence should feel like a last look, not a review score.",
  recommendations:
    "Food & Drink desk: end on atmosphere, ritual, or seasonal rhythm — never 'check it out' or 'perfect for everyone.' " +
    "Observation beats promotion.",
  bandits_pick:
    "Bandit's Pick: one timeless sentence that makes the reader carry the moment forward — " +
    "grounded in this week's evidence, never generic encouragement.",
  history:
    "Today in History: the final paragraph is ONE memorable observation unique to this event and year — " +
    "never 'this remains important today,' never a summary recap. Use verified grounding only.",
};

export const LASTING_IMPRESSION_CORE =
  "Lasting Impression — end every long-form article with ONE thoughtful observation, not a summary:\n" +
  "• Leave the reader thinking · feel timeless · avoid cliché · avoid generic encouragement\n" +
  "• Never repeat earlier paragraphs · never summarize the article · never sound like AI\n" +
  "• Notice something small · connect place to memory · recognize changing seasons\n" +
  "• Highlight why people return · emphasize atmosphere over promotion · reward careful observation\n\n" +
  "Banned closings: \"Check it out\", \"Perfect for everyone\", \"Whether you're local or visiting\", " +
  "\"Don't miss it\", \"A great place to spend the day\", \"In summary\", \"Overall\", recap bullets.\n" +
  "Good closings read like a great newspaper editor's last line — quiet, specific, memorable.";

export function buildLastingImpressionPromptBlock(
  desk?: LastingImpressionDesk
): string {
  if (!desk) return LASTING_IMPRESSION_CORE;
  return `${LASTING_IMPRESSION_CORE}\n${DESK_GUIDANCE[desk]}`;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordOverlapRatio(a: string, b: string): number {
  const wordsA = new Set(normalizeForComparison(a).split(" ").filter(Boolean));
  const wordsB = new Set(normalizeForComparison(b).split(" ").filter(Boolean));
  if (!wordsA.size || !wordsB.size) return 0;
  let shared = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) shared += 1;
  }
  return shared / Math.min(wordsA.size, wordsB.size);
}

export function closingRepeatsEarlierParagraph(
  closing: string,
  priorParagraphs: readonly string[]
): boolean {
  const normalizedClosing = normalizeForComparison(closing);
  if (!normalizedClosing) return false;

  for (const prior of priorParagraphs) {
    const normalizedPrior = normalizeForComparison(prior);
    if (!normalizedPrior) continue;
    if (
      normalizedPrior === normalizedClosing ||
      normalizedPrior.includes(normalizedClosing) ||
      normalizedClosing.includes(normalizedPrior)
    ) {
      return true;
    }
    if (wordOverlapRatio(closing, prior) >= 0.72) return true;
  }
  return false;
}

export type LastingImpressionResult = {
  passes: boolean;
  reason?:
    | "empty"
    | "promotional"
    | "summary"
    | "generic"
    | "repeated"
    | "weak";
  pattern?: string;
};

export function containsPromotionalClosing(
  text: string | null | undefined
): boolean {
  const raw = text?.trim();
  if (!raw) return false;
  return PROMOTIONAL_CLOSING_PATTERNS.some((pattern) => pattern.test(raw));
}

export function validateLastingImpressionClosing(
  closing: string | null | undefined,
  options?: {
    priorParagraphs?: readonly string[];
    subjectTokens?: string[];
  }
): LastingImpressionResult {
  const trimmed = closing?.trim() ?? "";
  if (!trimmed) return { passes: false, reason: "empty" };

  const promotional = PROMOTIONAL_CLOSING_PATTERNS.find((p) => p.test(trimmed));
  if (promotional) {
    return { passes: false, reason: "promotional", pattern: promotional.source };
  }

  if (endingReadsLikeSummary(trimmed)) {
    return { passes: false, reason: "summary" };
  }

  if (containsGenericPlaceObservation(trimmed)) {
    return { passes: false, reason: "generic" };
  }

  const genericConclusion = findGenericConclusionPattern(trimmed);
  if (genericConclusion) {
    return { passes: false, reason: "generic", pattern: genericConclusion.source };
  }

  const genericThought = findGenericLastingThoughtPattern(trimmed);
  if (genericThought) {
    return { passes: false, reason: "generic", pattern: genericThought.source };
  }

  const unique = validateUniqueConclusion(trimmed, {
    subjectTokens: options?.subjectTokens,
  });
  if (!unique.passes && unique.reason === "generic_pattern") {
    return { passes: false, reason: "generic", pattern: unique.pattern };
  }

  const prior = options?.priorParagraphs ?? [];
  if (prior.length && closingRepeatsEarlierParagraph(trimmed, prior)) {
    return { passes: false, reason: "repeated" };
  }

  const hasSignal =
    hasMemorableIdeaSignal(trimmed) ||
    LASTING_IMPRESSION_EXAMPLES.some(
      (example) => normalizeForComparison(example) === normalizeForComparison(trimmed)
    ) ||
    (options?.subjectTokens ?? []).some((token) => {
      const t = token.trim();
      return t.length > 3 && trimmed.toLowerCase().includes(t.toLowerCase());
    });

  if (!hasSignal) {
    return { passes: false, reason: "weak" };
  }

  return { passes: true };
}

export function selectLastingImpressionClosing(
  seed: string,
  title?: string | null
): string {
  const key = `${seed}:${title ?? ""}`;
  const idx = hashString(key) % LASTING_IMPRESSION_EXAMPLES.length;
  return LASTING_IMPRESSION_EXAMPLES[idx]!;
}

export function lastingImpressionClosingForPlace(
  title: string,
  seed: string,
  typeLabel?: string | null
): string {
  const t = (typeLabel ?? "").toLowerCase();
  const keyed = `${seed}:${title}:${t}`;

  if (/park|garden|trail|hiking|beach|scenic|lookout/.test(t)) {
    const seasonal = [
      "The scenery changes with the seasons, but the feeling of slowing down here rarely does.",
      "Morning is when this place quietly shines.",
      "Most visitors remember the destination. Locals often remember the walk getting there.",
    ];
    return seasonal[hashString(keyed) % seasonal.length]!;
  }
  if (/coffee|restaurant|bakery|brewery|bar/.test(t)) {
    const ritual = [
      "Every community has places that quietly become part of people's routines. This is one of them.",
      "Regulars tend to find a preferred hour and protect it.",
      "Some experiences are exciting because they're rare. Others become meaningful because people return to them again and again.",
    ];
    return ritual[hashString(keyed) % ritual.length]!;
  }
  if (/museum|gallery|theater|concert|music/.test(t)) {
    const memory = [
      "Long after you leave, it's often the small detail you noticed first that stays with you.",
      "The best discoveries are often the ones that never needed a headline.",
    ];
    return memory[hashString(keyed) % memory.length]!;
  }

  return selectLastingImpressionClosing(seed, title);
}

export function lastingImpressionClosingForEvent(
  title: string,
  seed: string,
  category?: string | null
): string {
  const keyed = `${seed}:${title}:${category ?? ""}`;

  if (category === "music" || category === "comedy" || category === "arts") {
    const lines = [
      "Long after the event ends, it's often the conversations afterward that people remember.",
      "The evening tends to linger in memory longer than the drive home.",
    ];
    return lines[hashString(keyed) % lines.length]!;
  }
  if (category === "market" || category === "food") {
    return "Some experiences are exciting because they're rare. Others become meaningful because people return to them again and again.";
  }

  return selectLastingImpressionClosing(seed, title);
}

export function ensureLastingImpressionClosing(
  paragraphs: string[],
  fallbackClosing: string
): string[] {
  if (!paragraphs.length) return [fallbackClosing];

  const prior = paragraphs.slice(0, -1);
  const last = paragraphs.at(-1) ?? "";
  const validation = validateLastingImpressionClosing(last, { priorParagraphs: prior });

  if (validation.passes) return paragraphs;

  const replacement = closingRepeatsEarlierParagraph(fallbackClosing, prior)
    ? selectLastingImpressionClosing(
        `${fallbackClosing}:${paragraphs.length}`,
        prior[0] ?? null
      )
    : fallbackClosing;

  if (prior.length === 0) return [replacement];
  return [...prior, replacement];
}

export function validateLastingImpressionBody(
  paragraphs: readonly string[],
  options?: { subjectTokens?: string[] }
): LastingImpressionResult {
  if (!paragraphs.length) return { passes: false, reason: "empty" };
  const prior = paragraphs.slice(0, -1);
  const closing = paragraphs.at(-1) ?? "";
  return validateLastingImpressionClosing(closing, {
    priorParagraphs: prior,
    subjectTokens: options?.subjectTokens,
  });
}
