/**
 * Phase 8 — Editorial Fact & Source Confidence Engine (client mirror)
 * Keep in sync with supabase/functions/_shared/editorial/sourceConfidence.ts
 */

export type SourceConfidenceLevel =
  | "verified"
  | "high_confidence"
  | "inferred"
  | "unknown";

export type SourceConfidenceDesk =
  | "events"
  | "activities"
  | "recommendations"
  | "bandits_pick"
  | "history"
  | "places_note";

export const INFERENCE_HEDGE_PATTERNS: RegExp[] = [
  /\blikely\b/i,
  /\bprobably\b/i,
  /\bmay\b/i,
  /\bmight\b/i,
  /\btends to\b/i,
  /\boften\b/i,
  /\busually\b/i,
  /\bappears to\b/i,
  /\bcan feel\b/i,
  /\breads as\b/i,
  /\blisted as\b/i,
  /\baccording to\b/i,
  /\bif the listing\b/i,
  /\bconfirm on the listing\b/i,
];

export const UNSUPPORTED_CROWD_PATTERNS: RegExp[] = [
  /\b(?:always|usually|often|typically) (?:packed|crowded|full|busy)\b/i,
  /\bstanding room only\b/i,
  /\bsells out (?:quickly|fast|every|within)\b/i,
  /\b(?:hundreds|thousands) of (?:people|visitors|attendees|fans)\b/i,
  /\b(?:huge|massive|enormous) crowds?\b/i,
  /\bpacked (?:house|room|venue)\b/i,
];

export const UNSUPPORTED_WAIT_PATTERNS: RegExp[] = [
  /\bwait times? (?:are|is|can be|usually|often)\b/i,
  /\b(?:long|short) lines?\b/i,
  /\b(?:hour|minute)s? (?:wait|line)\b/i,
];

export const UNSUPPORTED_LOCAL_CLAIM_PATTERNS: RegExp[] = [
  /\blocals love\b/i,
  /\blocals adore\b/i,
  /\blocals flock\b/i,
  /\blocals swear by\b/i,
  /\beveryone (?:knows|loves|raves|agrees)\b/i,
  /\bmost people (?:love|prefer|go|come)\b/i,
  /\bcrowd favorite\b/i,
  /\bcity favorite\b/i,
  /\bneighborhood favorite\b/i,
  /\ba local institution\b/i,
  /\bbeloved by locals\b/i,
];

export const UNSUPPORTED_SUPERLATIVE_PATTERNS: RegExp[] = [
  /\b(?:the )?best\b[^.!?]{0,56}\b(?:in town|in the city|in the area|around)\b/i,
  /\bthe best (?:in town|in the city|in [A-Z][a-z]+|around)\b/i,
  /\bmost popular\b/i,
  /\bmost famous\b/i,
  /\bworld[- ]class\b/i,
  /\bhighly acclaimed\b/i,
  /\bcan't[- ]miss\b/i,
  /\bnumber one\b/i,
  /\b#1\b/i,
  /\bunmatched\b/i,
  /\bsecond to none\b/i,
];

export const UNSUPPORTED_SENSORY_FACT_PATTERNS: RegExp[] = [
  /\bsmells like\b/i,
  /\btastes like\b/i,
  /\bfeels like\b/i,
  /\byou(?:'ll| will) (?:always|definitely|surely) (?:hear|smell|see|feel)\b/i,
  /\bthe (?:sound|smell|aroma) of (?:fresh|warm|wood|baking)\b/i,
];

export const CONFIDENT_HISTORICAL_PATTERNS: RegExp[] = [
  /\b(?:built|established|opened|founded|dates back to|has stood since)\b[^.]{0,24}\b(?:in )?\d{3,4}\b/i,
  /\b(?:since|from) (?:the )?\d{3,4}s?\b/i,
  /\bfor over \d+ (?:years|decades|centuries)\b/i,
];

const DESK_GUIDANCE: Record<SourceConfidenceDesk, string> = {
  events:
    "Events desk: only state schedule, venue, badges, and listing facts from the brief as verified. " +
    "Never invent attendance, wait times, crowd energy beyond category, or parking.",
  activities:
    "Activities desk: verified listing fields may be stated directly. Category timing (weekday mornings, early evening) " +
    "must use inference hedges — 'likely', 'tends to', 'usually'.",
  recommendations:
    "Food & Drink desk: name, address, and provider category are verified. Atmosphere beyond that is inferred or omitted.",
  bandits_pick:
    "Bandit's Pick: ground every sentence in the evidence brief. Seasonal timing may be inferred with hedges only.",
  history:
    "Today in History: only historical facts from grounding data are verified. Never invent scene-setting or attendance.",
  places_note:
    "Place notes: one sentence from name/address/category only. No invented popularity, smells, or history.",
};

export const SOURCE_CONFIDENCE_CORE =
  "Source Confidence — accuracy before quantity:\n" +
  "• Verified facts (in the brief) may be stated confidently — e.g. \"Built in 1912…\" only when grounding provides the year.\n" +
  "• Inferred facts must be cautious — e.g. \"The trail is likely quietest early in the morning…\"\n" +
  "• Unknown facts must be omitted — never invent attendance, wait times, popularity, sounds, smells, crowd size, or history.\n\n" +
  "Never write unsupported: \"locals love…\", \"most people…\", \"always crowded\", wait-time claims, \"the best in town\", " +
  "confident smells/sounds, or historical dates not in the brief.\n" +
  "Prefer omission over speculation. Remove unsupported adjectives and superlatives.";

export function buildSourceConfidencePromptBlock(
  desk?: SourceConfidenceDesk
): string {
  if (!desk) return SOURCE_CONFIDENCE_CORE;
  return `${SOURCE_CONFIDENCE_CORE}\n${DESK_GUIDANCE[desk]}`;
}

export function containsInferenceHedge(text: string | null | undefined): boolean {
  const raw = text?.trim();
  if (!raw) return false;
  return INFERENCE_HEDGE_PATTERNS.some((pattern) => pattern.test(raw));
}

function normalizedHaystack(text: string | null | undefined): string {
  return (text ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function isGroundedInVerifiedHaystack(
  text: string,
  verifiedHaystack?: string | null
): boolean {
  const hay = normalizedHaystack(verifiedHaystack);
  if (!hay) return false;
  const sample = normalizedHaystack(text);
  if (sample.length >= 12 && hay.includes(sample.slice(0, Math.min(sample.length, 48)))) {
    return true;
  }
  const yearMatch = text.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  if (yearMatch && hay.includes(yearMatch[1]!)) return true;
  return false;
}

export function containsUnsupportedCrowdClaim(
  text: string | null | undefined
): boolean {
  const raw = text?.trim();
  if (!raw) return false;
  return UNSUPPORTED_CROWD_PATTERNS.some((pattern) => pattern.test(raw));
}

export function containsUnsupportedWaitClaim(
  text: string | null | undefined
): boolean {
  const raw = text?.trim();
  if (!raw) return false;
  return UNSUPPORTED_WAIT_PATTERNS.some((pattern) => pattern.test(raw));
}

export function containsUnsupportedLocalClaim(
  text: string | null | undefined
): boolean {
  const raw = text?.trim();
  if (!raw) return false;
  return UNSUPPORTED_LOCAL_CLAIM_PATTERNS.some((pattern) => pattern.test(raw));
}

export function containsUnsupportedSuperlative(
  text: string | null | undefined
): boolean {
  const raw = text?.trim();
  if (!raw) return false;
  return UNSUPPORTED_SUPERLATIVE_PATTERNS.some((pattern) => pattern.test(raw));
}

export function containsUnsupportedSensoryFact(
  text: string | null | undefined
): boolean {
  const raw = text?.trim();
  if (!raw) return false;
  return UNSUPPORTED_SENSORY_FACT_PATTERNS.some((pattern) => pattern.test(raw));
}

export function containsConfidentHistoricalClaim(
  text: string | null | undefined,
  options?: { verifiedHaystack?: string | null; desk?: SourceConfidenceDesk }
): boolean {
  const raw = text?.trim();
  if (!raw) return false;
  if (options?.desk === "history" && isGroundedInVerifiedHaystack(raw, options.verifiedHaystack)) {
    return false;
  }
  if (isGroundedInVerifiedHaystack(raw, options?.verifiedHaystack)) return false;
  if (!CONFIDENT_HISTORICAL_PATTERNS.some((pattern) => pattern.test(raw))) return false;
  return !containsInferenceHedge(raw);
}

export type SourceConfidenceResult = {
  passes: boolean;
  reason?:
    | "empty"
    | "crowd"
    | "wait_time"
    | "local_claim"
    | "superlative"
    | "sensory"
    | "historical"
    | "unsupported";
  pattern?: string;
};

export function validateSourceConfidenceText(
  text: string | null | undefined,
  options?: {
    desk?: SourceConfidenceDesk;
    verifiedHaystack?: string | null;
  }
): SourceConfidenceResult {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) return { passes: false, reason: "empty" };

  const crowd = UNSUPPORTED_CROWD_PATTERNS.find((p) => p.test(trimmed));
  if (crowd && !isGroundedInVerifiedHaystack(trimmed, options?.verifiedHaystack)) {
    return { passes: false, reason: "crowd", pattern: crowd.source };
  }

  const wait = UNSUPPORTED_WAIT_PATTERNS.find((p) => p.test(trimmed));
  if (wait && !isGroundedInVerifiedHaystack(trimmed, options?.verifiedHaystack)) {
    return { passes: false, reason: "wait_time", pattern: wait.source };
  }

  const local = UNSUPPORTED_LOCAL_CLAIM_PATTERNS.find((p) => p.test(trimmed));
  if (
    local &&
    !containsInferenceHedge(trimmed) &&
    !isGroundedInVerifiedHaystack(trimmed, options?.verifiedHaystack)
  ) {
    return { passes: false, reason: "local_claim", pattern: local.source };
  }

  const superlative = UNSUPPORTED_SUPERLATIVE_PATTERNS.find((p) => p.test(trimmed));
  if (superlative && !containsInferenceHedge(trimmed)) {
    return { passes: false, reason: "superlative", pattern: superlative.source };
  }

  const sensory = UNSUPPORTED_SENSORY_FACT_PATTERNS.find((p) => p.test(trimmed));
  if (sensory && !isGroundedInVerifiedHaystack(trimmed, options?.verifiedHaystack)) {
    return { passes: false, reason: "sensory", pattern: sensory.source };
  }

  if (containsConfidentHistoricalClaim(trimmed, options)) {
    return { passes: false, reason: "historical" };
  }

  return { passes: true };
}

export function filterSourceConfidenceParagraphs(
  paragraphs: string[],
  options?: {
    desk?: SourceConfidenceDesk;
    verifiedHaystack?: string | null;
  }
): string[] {
  return paragraphs
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => {
      if (p.length < 12) return false;
      return validateSourceConfidenceText(p, options).passes;
    });
}

export function classifySourceConfidenceLevel(input: {
  hasVerifiedSource: boolean;
  hasListingFields: boolean;
  usesHedgeLanguage: boolean;
}): SourceConfidenceLevel {
  if (input.hasVerifiedSource) return "verified";
  if (input.hasListingFields) return "high_confidence";
  if (input.usesHedgeLanguage) return "inferred";
  return "unknown";
}

export function sourceConfidenceDeskForPlacesCategory(
  category: string
): Exclude<SourceConfidenceDesk, "events" | "bandits_pick" | "history"> {
  if (
    /water_recreation|escape_rooms|bowling|mini_golf|rock_climbing|axe_throwing|go_karts|pickleball|arcades|laser_tag|paintball|billiards|roller_skating|ice_skating|karaoke|batting_cages/.test(
      category
    )
  ) {
    return "activities";
  }
  return "recommendations";
}

export function validateSourceConfidenceBody(
  paragraphs: readonly string[],
  options?: {
    desk?: SourceConfidenceDesk;
    verifiedHaystack?: string | null;
  }
): SourceConfidenceResult {
  if (!paragraphs.length) return { passes: false, reason: "empty" };
  for (const paragraph of paragraphs) {
    const result = validateSourceConfidenceText(paragraph, options);
    if (!result.passes) return result;
  }
  return { passes: true };
}
