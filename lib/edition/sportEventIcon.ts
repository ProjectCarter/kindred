/**
 * Sport-specific event icons — one verified sport, one emoji.
 * Fallback 🏅 when sport cannot be confidently identified.
 */

import type { LocalEventCategory } from "./localEvents";
import { resolveHometownTeamSport } from "./hometownTeams/matchHometownTeam";

export const SPORT_EVENT_ICON_FALLBACK = "🏅";

export const SPORT_EVENT_ICONS = {
  baseball: "⚾",
  basketball: "🏀",
  football: "🏈",
  soccer: "⚽",
  hockey: "🏒",
  martial_arts: "🥋",
  boxing_mma: "🥊",
  wrestling: "🤼",
  tennis: "🎾",
  pickleball: "🏓",
  softball: "⚾",
  curling: "🥌",
  billiards: "🎱",
  table_tennis: "🏓",
  volleyball: "🏐",
  running: "🏃",
  cycling: "🚴",
  swimming: "🏊",
  gymnastics: "🤸",
  horse_racing: "🏇",
  motorsports: "🏎️",
  bowling: "🎳",
  darts: "🎯",
  golf: "⛳",
  fishing: "🎣",
  skateboarding: "🛹",
  badminton: "🏸",
  skiing: "⛷️",
  snowboarding: "🏂",
} as const;

export type SportEventIconKey = keyof typeof SPORT_EVENT_ICONS;

type SportIconRule = {
  test: RegExp;
  icon: string;
};

/**
 * Generic sport keyword rules — market-specific teams resolve via hometownTeams catalog.
 */
const SPORT_ICON_RULES: SportIconRule[] = [
  // Golf — strict; never match unless clearly golf
  {
    test: /\b(pga\b|lpga\b|golf tournament|golf outing|golf classic|golf scramble|\bgolf\b|\bputt(?:ing)?\b|country club tournament)\b/i,
    icon: SPORT_EVENT_ICONS.golf,
  },

  // Combat & court sports
  {
    test: /\b(karate|taekwondo|judo|jiu-?jitsu|martial arts|kung fu|aikido)\b/i,
    icon: SPORT_EVENT_ICONS.martial_arts,
  },
  { test: /\b(boxing|mma\b|ufc\b|mixed martial arts)\b/i, icon: SPORT_EVENT_ICONS.boxing_mma },
  { test: /\b(wrestling|wwe\b|aew\b)\b/i, icon: SPORT_EVENT_ICONS.wrestling },
  { test: /\bvolleyball\b/i, icon: SPORT_EVENT_ICONS.volleyball },
  { test: /\bpickleball\b/i, icon: SPORT_EVENT_ICONS.pickleball },
  { test: /\b(table tennis|ping pong)\b/i, icon: SPORT_EVENT_ICONS.table_tennis },
  { test: /\btennis\b/i, icon: SPORT_EVENT_ICONS.tennis },
  { test: /\bbadminton\b/i, icon: SPORT_EVENT_ICONS.badminton },

  // Field & diamond sports
  { test: /\b(baseball|\bmlb\b|\bllws\b|little league world series)\b/i, icon: SPORT_EVENT_ICONS.baseball },
  { test: /\bsoftball\b/i, icon: SPORT_EVENT_ICONS.softball },
  { test: /\b(basketball|\bwnba\b|\bnba\b|\bncaa\b.*basketball)\b/i, icon: SPORT_EVENT_ICONS.basketball },
  {
    test: /\b(soccer|futbol|\bmls\b|\bfifa\b|world cup qualifier)\b/i,
    icon: SPORT_EVENT_ICONS.soccer,
  },
  {
    test: /\b(hockey|\bnhl\b|hockey game|puck drop)\b/i,
    icon: SPORT_EVENT_ICONS.hockey,
  },
  {
    test: /\b(football game|\bnfl\b|\bncaa\b.*football|touchdown|\bgridiron\b)\b/i,
    icon: SPORT_EVENT_ICONS.football,
  },

  // Endurance & outdoor
  { test: /\b(marathon|half marathon|5k\b|10k\b|fun run|running race|\btrack meet\b)\b/i, icon: SPORT_EVENT_ICONS.running },
  { test: /\b(cycling|bike race|gran fondo|criterium|\bvelodrome\b)\b/i, icon: SPORT_EVENT_ICONS.cycling },
  { test: /\b(swim meet|swimming|aquatics|\bdiving\b)\b/i, icon: SPORT_EVENT_ICONS.swimming },
  { test: /\bgymnastics\b/i, icon: SPORT_EVENT_ICONS.gymnastics },
  { test: /\b(horse racing|derby day|rodeo)\b/i, icon: SPORT_EVENT_ICONS.horse_racing },
  {
    test: /\b(nascar|indycar|formula\s*1|\bf1\b|motocross|motorsport|auto racing|drag racing)\b/i,
    icon: SPORT_EVENT_ICONS.motorsports,
  },
  { test: /\bbowling\b/i, icon: SPORT_EVENT_ICONS.bowling },
  { test: /\b(billiards|pool hall|snooker)\b/i, icon: SPORT_EVENT_ICONS.billiards },
  { test: /\bcurling\b/i, icon: SPORT_EVENT_ICONS.curling },
  { test: /\bdarts\b/i, icon: SPORT_EVENT_ICONS.darts },
  { test: /\b(fishing|fish(?:ing)? tournament)\b/i, icon: SPORT_EVENT_ICONS.fishing },
  { test: /\bskateboard/i, icon: SPORT_EVENT_ICONS.skateboarding },
  { test: /\b(skiing|ski race|\bslalom\b)\b/i, icon: SPORT_EVENT_ICONS.skiing },
  { test: /\bsnowboard/i, icon: SPORT_EVENT_ICONS.snowboarding },
];

function sportHay(input: {
  name: string;
  venue?: string | null;
  dek?: string | null;
}): string {
  return [input.name, input.venue, input.dek].filter(Boolean).join(" ").toLowerCase();
}

/**
 * Resolve the most appropriate sport emoji for a sports event.
 * Returns 🏅 when the sport cannot be confidently identified.
 */
export function resolveSportEventIcon(
  input: {
    name: string;
    venue?: string | null;
    dek?: string | null;
    category?: LocalEventCategory | null;
  },
  options?: {
    sportsMarketId?: string | null;
  }
): string {
  const teamSport = resolveHometownTeamSport(input, options?.sportsMarketId);
  if (teamSport) return SPORT_EVENT_ICONS[teamSport];

  const hay = sportHay(input);

  for (const rule of SPORT_ICON_RULES) {
    if (rule.test.test(hay)) return rule.icon;
  }

  if (input.category === "sports") return SPORT_EVENT_ICON_FALLBACK;
  return "";
}
