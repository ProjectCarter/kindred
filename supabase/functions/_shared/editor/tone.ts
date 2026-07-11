import type { EditorialGeoScope, EditorialTone } from "./types.ts";

/** Heavy / doomscrolling language — an editor would not stack these. */
export const HEAVY_TONE_HINTS =
  /\b(kill|killed|deaths?|deadly|massacre|atrocity|war crimes?|bombing|explosion|hostage|genocide|catastrophe|crisis deepens|body count|fatal|murder|shooting|terror|tragedy|disaster|collapse|recession fear|worst[- ]ever)\b/i;

export const UPLIFT_TONE_HINTS =
  /\b(discover|breakthrough|rescued|recovers|opens|celebrate|art|museum|garden|wildlife|community|kindness|solves|invention|debut|hope|revival|reunite|wins?|champion)\b/i;

export const WORLD_SCOPE_HINTS =
  /\b(united nations|nato|european union|middle east|ukraine|gaza|beijing|moscow|brussels|tokyo|global|worldwide|international|abroad|overseas|foreign)\b/i;

export const NATIONAL_SCOPE_HINTS =
  /\b(president|congress|white house|supreme court|nation|federal|senate|election|washington)\b/i;

export function classifyTone(text: string, isBreaking = false): EditorialTone {
  if (isBreaking) return "breaking";
  if (UPLIFT_TONE_HINTS.test(text)) return "uplifting";
  if (HEAVY_TONE_HINTS.test(text)) return "heavy";
  if (/\b(museum|science|health|culture|food|cook|sport|design)\b/i.test(text)) {
    return "feature";
  }
  return "neutral";
}

export function classifyGeo(
  text: string,
  pool: string,
  hasLocalSignal: boolean
): EditorialGeoScope {
  if (hasLocalSignal || pool === "local") return "local";
  if (WORLD_SCOPE_HINTS.test(text)) return "world";
  if (NATIONAL_SCOPE_HINTS.test(text) || pool === "general") return "national";
  return "mixed";
}

export function isHeavyStory(text: string): boolean {
  return HEAVY_TONE_HINTS.test(text);
}

export function isUpliftingStory(text: string): boolean {
  return UPLIFT_TONE_HINTS.test(text);
}
