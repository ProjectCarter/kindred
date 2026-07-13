import type { EditorialGeoScope, EditorialTone } from "./types.ts";

/**
 * Kindred's mission is to help people have a better day, not to farm
 * doomscrolling engagement. These hints are the shared editorial-tone
 * signal used everywhere a news candidate is scored, capped, or chosen —
 * Top Stories, the Lead, and Bandit's Pick all read from this one bank
 * so the whole paper stays consistent instead of drifting apart.
 *
 * Fear, violence, disaster, and manufactured outrage/scandal all read the
 * same way to a tired reader at 7am — an editor would not stack any of
 * them on the front page by default.
 */
export const HEAVY_TONE_HINTS =
  /\b(kill(?:ed|ing|s)?|deaths?|deadly|massacre|atrocity|war crimes?|bombing|explosion|hostage|genocide|catastrophe|crisis deepens|body count|fatal(?:ity|ities)?|murder(?:ed|s)?|homicide|manslaughter|shooting|shot dead|gunman|stabbing|stabbed|assault(?:ed)?|abduct(?:ed|ion)?|kidnap(?:ped|ping)?|terror(?:ism|ist|attack)?|tragedy|disaster|collapse|recession fear|worst[- ]ever|wildfire|earthquake|flood(?:ing)?|hurricane|tornado|tsunami|landslide|wreckage|carnage|riot(?:s|ing)?|looting|car crash|fatal crash|deadly crash|pileup|violent(?:ly)?|violence|slams?|blasts?|erupts? in fury|outrage(?:d)?|scandal(?:ous)?|feud(?:ing)?|meltdown|backlash|goes viral|controvers(?:y|ial)|accused of|lawsuit|sues?|sued|indict(?:ed|ment)?|divorce|cheating scandal|allegations?|smear campaign|conspiracy theory|bombshell|shocking|jaw-dropping|you won'?t believe|feuding)\b/i;

/**
 * Genuinely important to safety or daily life — never suppressed for
 * tone, regardless of how "heavy" the language sounds. A wildfire
 * evacuation notice and a wildfire disaster movie recap should not be
 * scored the same way.
 */
export const PUBLIC_SAFETY_HINTS =
  /\b(evacuat(?:e|ion|ed|ing)|road closure|closed indefinitely|closure affects?|boil water|water main break|power outage|outage affects?|severe weather|weather warning|storm warning|flood warning|tornado warning|winter storm warning|air quality alert|amber alert|missing (?:child|person|teen)|school closure|closed schools?|shelter in place|state of emergency|public health alert|health department warns|recall(?:ed|s)? (?:due to|over|after)|contamina(?:ted|tion)|advisory issued|curfew|travel advisory|voluntary evacuation|mandatory evacuation|emergency declared|disaster declaration)\b/i;

/**
 * Kindred's actual editorial center of gravity: the things that make
 * someone feel more connected to, and better about, the place they live.
 */
export const UPLIFT_TONE_HINTS =
  /\b(discover(?:y|ed|ies)?|breakthrough|rescued|recovers|opens|celebrat(?:e|ion|ed|ing)|art|museum|gallery|garden|wildlife|community|kindness|solves|invention|debut|hope|revival|reunite[ds]?|wins?|champion|festival|farmers'? market|small business|local (?:shop|business|favorite|artist|chef)|main street|hik(?:e|ing|er)|trail(?:head)?|park|beach|coffee|café|bakery|restaurant|chef|cuisine|neighborhood|volunteer(?:s|ing)?|charity|fundraiser|scholarship|history|historic(?:al)?|heritage|landmark|astronomy|space telescope|species|conservation|habitat|mural|exhibit|concert|weekend|family[- ]friendly|kid[- ]friendly|hidden gem|scenic|nature preserve|reopens?|milestone|anniversary|beloved|heartwarming|charming|delight(?:ful)?|whimsical|inspir(?:e|ing|ation)|first responders? honored|good samaritan|pay(?:s|ing) it forward)\b/i;

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

/** Raw tone signal — fear, violence, disaster, outrage, scandal, drama. */
export function isHeavyStory(text: string): boolean {
  return HEAVY_TONE_HINTS.test(text);
}

/** Genuinely important — evacuations, closures, severe weather, recalls. */
export function isPublicSafetyStory(text: string): boolean {
  return PUBLIC_SAFETY_HINTS.test(text);
}

export function isUpliftingStory(text: string): boolean {
  return UPLIFT_TONE_HINTS.test(text);
}

/**
 * The actual policy question every scorer/selector should ask: should
 * this story's heavy tone count against it? Not a hard blacklist — a
 * story stays exempt the moment it also reads as a safety or
 * daily-life matter, so evacuation notices, severe weather, and road
 * closures are never buried just because they use "heavy" words.
 */
export function shouldDeprioritizeForTone(text: string): boolean {
  return isHeavyStory(text) && !isPublicSafetyStory(text);
}
