/**
 * Phase 6 — Human Details Engine
 * Teach editorial desks to notice small human details — never fabricate them.
 * Keep in sync with lib/edition/humanDetails.ts
 */

import { containsGenericAiPhrase } from "./editorialIntelligence.ts";

export type HumanDetailsDesk =
  | "events"
  | "activities"
  | "recommendations"
  | "bandits_pick"
  | "history";

/** Generic praise — never publish as human observation. */
export const GENERIC_PLACE_OBSERVATION_PATTERNS: RegExp[] = [
  /\bbeautiful place\b/i,
  /\bbeautiful (?:spot|location|destination|setting)\b/i,
  /\bhidden gem\b/i,
  /\bperfect for everyone\b/i,
  /\bmust visit\b/i,
  /\bmust-?visit\b/i,
  /\bnice place to visit\b/i,
  /\bwonderful place\b/i,
  /\bamazing place\b/i,
  /\bstunning (?:views?|place|location)\b/i,
  /\bperfect spot for everyone\b/i,
];

/** Details that read invented without grounding in the brief. */
export const FABRICATED_HUMAN_DETAIL_PATTERNS: RegExp[] = [
  /\beveryone (?:loves|raves about|says|agrees)\b/i,
  /\blocals (?:always|never|all) (?:say|know|tell|go)\b/i,
  /\b(?:always|never) (?:crowded|empty|packed|full)\b/i,
  /\bwait times? (?:are|is) (?:usually|always|never)\b/i,
  /\bperfect weather\b/i,
  /\bsmells like (?:fresh|warm|wood|lavender|vanilla|baking)\b/i,
  /\byou(?:'ll| will) (?:always|definitely) (?:hear|smell|see)\b/i,
  /\bthe best (?:view|seat|table) in town\b/i,
];

/** Signals that copy notices something a directory listing would miss. */
export const HUMAN_DETAIL_SIGNAL_PATTERNS: RegExp[] = [
  /\bmorning light\b/i,
  /\b(?:evening|afternoon|midday) light\b/i,
  /\blight (?:changes|shifts|falls|reaches)\b/i,
  /\blocals usually\b/i,
  /\bmost locals\b/i,
  /\bif you pause\b/i,
  /\b(?:many|most) (?:first-time )?visitors overlook\b/i,
  /\bfirst-time visitors\b/i,
  /\bquieter entrance\b/i,
  /\bquiet corner\b/i,
  /\bfavorite bench\b/i,
  /\blisten for\b/i,
  /\blook upward\b/i,
  /\blook (?:for|once|closer|up)\b/i,
  /\batmosphere changes\b/i,
  /\bfirst thing (?:you(?:'ll| will) )?notice\b/i,
  /\bwhere people (?:gather|pause|meet|linger)\b/i,
  /\bcrowd flow\b/i,
  /\btypical crowd\b/i,
  /\bseasonal (?:shift|change|rhythm)\b/i,
  /\bweekday mornings?\b/i,
  /\bearly evening\b/i,
  /\bgolden hour\b/i,
  /\bwithin walking distance\b/i,
  /\bnearby landmark\b/i,
  /\bbest direction to walk\b/i,
  /\blittle ritual\b/i,
  /\bthe room (?:softens|changes|settles)\b/i,
  /\bthe (?:trail|path|walk) (?:opens|narrows|curves)\b/i,
  /\bsticky fingers\b/i,
  /\blow hum\b/i,
  /\bwindow seat\b/i,
];

const DESK_GUIDANCE: Record<HumanDetailsDesk, string> = {
  events:
    "Events desk: one practical human observation when category, venue, or schedule supports it — " +
    "how the room feels before doors open, what regulars know about timing, what first-timers miss at the venue type. " +
    "Never invent crowd size, parking, or weather.",
  activities:
    "Activities desk: notice pacing, what to bring, how the experience unfolds — " +
    "the moment before you start, the quiet before lanes open, what regulars do first. " +
    "Infer only from venue type and verified listing facts.",
  recommendations:
    "Recommendations desk: where people pause, when locals go, seasonal rhythm, quiet corners, " +
    "how light or sound shifts through the day. Never invent menu items, smells, or popularity.",
  bandits_pick:
    "Bandit's Pick: one experiential observation that makes the reader feel the moment — " +
    "seasonal timing, what changes this week, what locals actually do. Ground every detail in the evidence brief.",
  history:
    "Today in History: human details only when the grounding data supports them — " +
    "a sensory or social detail from the verified record, not invented scene-setting. " +
    "Skip entirely when the archive gives facts but not atmosphere.",
};

export const HUMAN_DETAILS_CORE =
  "Human Details — write like an experienced local journalist who notices small things:\n" +
  "• Where people naturally gather · how light changes through the day · seasonal rhythm\n" +
  "• Sounds, textures, pacing · what locals usually notice · what first-time visitors miss\n" +
  "• Practical observations · little rituals · favorite benches · quiet corners\n" +
  "• Changing weather (only from brief) · nearby landmarks (only if named) · crowd flow · best direction to walk\n\n" +
  "Use ONE subtle observation when verified facts or honest category context allow — never force it.\n" +
  "If unsupported, omit entirely. Never fabricate smells, crowds, wait times, weather, or local opinions.\n\n" +
  "Prefer subtle phrasing: \"Morning light reaches…\", \"Locals usually…\", \"If you pause for a minute…\", " +
  "\"One detail many visitors overlook…\", \"The quieter entrance…\", \"Listen for…\", \"Look upward…\", " +
  "\"The atmosphere changes…\", \"The first thing you'll notice…\"\n\n" +
  "Banned generic praise: \"beautiful place\", \"hidden gem\", \"perfect for everyone\", \"must visit\".";

export function buildHumanDetailsPromptBlock(
  desk?: HumanDetailsDesk
): string {
  if (!desk) return HUMAN_DETAILS_CORE;
  return `${HUMAN_DETAILS_CORE}\n${DESK_GUIDANCE[desk]}`;
}

export function containsGenericPlaceObservation(
  text: string | null | undefined
): boolean {
  const raw = text?.trim();
  if (!raw) return false;
  return (
    GENERIC_PLACE_OBSERVATION_PATTERNS.some((pattern) => pattern.test(raw)) ||
    containsGenericAiPhrase(raw)
  );
}

export function containsFabricatedHumanDetail(
  text: string | null | undefined
): boolean {
  const raw = text?.trim();
  if (!raw) return false;
  return FABRICATED_HUMAN_DETAIL_PATTERNS.some((pattern) => pattern.test(raw));
}

export function hasHumanDetailSignal(text: string | null | undefined): boolean {
  const raw = text?.trim();
  if (!raw) return false;
  return HUMAN_DETAIL_SIGNAL_PATTERNS.some((pattern) => pattern.test(raw));
}

export function filterHumanDetailParagraphs(paragraphs: string[]): string[] {
  return paragraphs
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(
      (p) =>
        p.length >= 12 &&
        !containsGenericPlaceObservation(p) &&
        !containsFabricatedHumanDetail(p)
    );
}

export function humanDetailObservationForCategory(
  typeLabel: string,
  city?: string | null
): string | null {
  const t = typeLabel.toLowerCase();
  const area = city?.trim() ? ` around ${city.trim()}` : "";

  if (/coffee|cafe|café/.test(t)) {
    return `If you pause for a minute by the window, you'll notice whether the room is built for staying or for turning over tables — locals usually know which hour is theirs.`;
  }
  if (/museum|gallery/.test(t)) {
    return `One detail many visitors overlook: the quietest rooms are often on the far side of the main gallery, where crowd flow thins out.`;
  }
  if (/park|garden|trail|hiking|beach/.test(t)) {
    return `Morning light reaches the open stretches first${area} — weekday mornings tend to be when the path feels most unhurried.`;
  }
  if (/brewery|winery|bar/.test(t)) {
    return `The atmosphere changes noticeably between the first pour and the later crowd — locals usually know which window they prefer.`;
  }
  if (/farmers.? market|market/.test(t)) {
    return `The first hour belongs to regulars who know which stalls run out first — that's when the crowd flow is easiest to read.`;
  }
  if (/theater|concert|music|comedy/.test(t)) {
    return `If you arrive early, listen for how the room settles before the house lights drop — that's often when you notice the venue's real character.`;
  }
  if (/escape room|bowling|arcade|mini golf|go-kart|axe|climbing|kayak|paddle/.test(t)) {
    return `The first thing you'll notice is pacing — how quickly the experience pulls you in once you stop treating it like an errand.`;
  }
  if (/restaurant|bakery|bistro/.test(t)) {
    return `Locals usually know whether this kind of room rewards a weeknight or a slow weekend lunch — the crowd flow tells you which one you're in.`;
  }
  if (/bookstore|library/.test(t)) {
    return `The quieter corners are often upstairs or toward the back — where people pause longest without pretending to browse.`;
  }
  if (/scenic|lookout|overlook|viewpoint/.test(t)) {
    return `Look upward before you look outward — the best direction to walk is often the one with fewer people stopped at the first railing.`;
  }

  return null;
}

export function humanDetailsDeskForPlacesCategory(
  category: string
): Exclude<HumanDetailsDesk, "events" | "bandits_pick" | "history"> {
  if (
    /water_recreation|escape_rooms|bowling|mini_golf|rock_climbing|axe_throwing|go_karts|pickleball|arcades|laser_tag|paintball|billiards|roller_skating|ice_skating|karaoke|batting_cages/.test(
      category
    )
  ) {
    return "activities";
  }
  return "recommendations";
}

export function humanDetailObservationForEventCategory(
  category: string | null | undefined
): string | null {
  switch (category) {
    case "music":
      return `If you pause in the lobby before the set, listen for how the room changes when the first notes start — that's the detail regulars remember.`;
    case "comedy":
      return `The atmosphere changes quickly once the house settles — first-time visitors often miss how much timing matters in the first few minutes.`;
    case "arts":
      return `One detail many visitors overlook: the quiet moments between pieces are part of the experience, not filler.`;
    case "market":
      return `Locals usually arrive early, when the stalls are fullest and the crowd flow is easiest to navigate.`;
    case "family":
      return `The first thing you'll notice is pacing — whether the event is built for wandering or for staying in one spot.`;
    case "food":
      return `Morning setups and evening service often feel like two different events — check which one you're walking into.`;
    case "sports":
      return `Arrive early if you want to notice how the crowd flow shifts once the main event actually starts.`;
    case "nightlife":
      return `The room often reads differently in the first hour — before the peak crowd arrives and the lighting changes.`;
    default:
      return null;
  }
}
