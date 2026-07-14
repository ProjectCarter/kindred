// Kindred — shared helpers for deterministic (non-AI) editorial templates.
//
// Used by heroOpening.ts, weather/heroWeatherTag.ts, and
// bandit/morningLineTemplates.ts — anywhere a short front-page line is
// composed from real date/weather facts instead of an LLM call. Centralized
// so "calmer language" (no "scorching", no purple prose) and season/mood
// definitions only ever need to change in one place.

/** Deliberately capped at "hot" — no "scorching"/"blistering" tier. Calm, not dramatic. */
export type WeatherMood = "hot" | "warm" | "mild" | "cool" | "cold";

export function moodFromTempC(tempC: number): WeatherMood {
  if (tempC >= 29) return "hot"; // ~84°F+
  if (tempC >= 21) return "warm"; // ~70°F+
  if (tempC >= 13) return "mild"; // ~55°F+
  if (tempC >= 5) return "cool"; // ~41°F+
  return "cold";
}

export type Season = "winter" | "spring" | "summer" | "autumn";

/** Meteorological seasons (Northern Hemisphere framing — matches how a US-first newspaper talks about the calendar). */
export function seasonFromMonthIndex(monthIndex0: number): Season {
  if (monthIndex0 === 11 || monthIndex0 <= 1) return "winter";
  if (monthIndex0 <= 4) return "spring";
  if (monthIndex0 <= 7) return "summer";
  return "autumn";
}

/**
 * One evocative-but-plain word for "season + how it actually feels today" —
 * e.g. "crisp" for a cool autumn/winter day, "beautiful" for a clear spring
 * day — falling back to the plain mood word when nothing season-specific
 * fits. Never poetic beyond a single common adjective.
 */
export function seasonalMoodWord(
  season: Season,
  mood: WeatherMood | null,
  skyIsClear: boolean
): string {
  if (season === "winter") {
    return mood === "cold" || mood === "cool" || !mood ? "crisp" : mood;
  }
  if (season === "autumn") {
    return mood === "cool" || mood === "cold" || !mood ? "crisp" : mood;
  }
  if (season === "spring") {
    if (skyIsClear || !mood) return "beautiful";
    return mood;
  }
  // summer
  return mood ?? "warm";
}

export type ShortSky = { adj: string; short: string; isClear: boolean };

/**
 * Short, tag-line forms of the Open-Meteo `weather_code` — distinct from
 * weather/units.ts's `weatherConditionPhrase`, which returns longer clauses
 * ("plenty of sunshine") meant for full sentences. These are 1-2 words,
 * meant for a 5-8 word hero tag.
 */
export function shortSky(code: number | null | undefined): ShortSky | null {
  if (code == null || !Number.isFinite(code)) return null;
  if (code === 0) return { adj: "sunny", short: "Sunny", isClear: true };
  if (code === 1) return { adj: "clear", short: "Clear skies", isClear: true };
  if (code === 2) return { adj: "partly cloudy", short: "Partly cloudy", isClear: false };
  if (code === 3) return { adj: "cloudy", short: "Cloudy", isClear: false };
  if (code === 45 || code === 48) return { adj: "foggy", short: "Foggy", isClear: false };
  if ([51, 53, 55, 56, 57].includes(code)) return { adj: "drizzly", short: "Drizzly", isClear: false };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { adj: "rainy", short: "Rainy", isClear: false };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { adj: "snowy", short: "Snowy", isClear: false };
  if ([95, 96, 99].includes(code)) return { adj: "stormy", short: "Stormy", isClear: false };
  return null;
}

export type EditionDateParts = {
  dayName: string;
  monthDay: string;
  monthName: string;
  monthIndex: number;
  season: Season;
  isWeekend: boolean;
  isSunday: boolean;
};

export function editionDateParts(editionDate: string): EditionDateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(editionDate);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date();
  const safe = Number.isNaN(date.getTime()) ? new Date() : date;
  const monthIndex = safe.getMonth();
  const dow = safe.getDay();
  return {
    dayName: safe.toLocaleDateString("en-US", { weekday: "long" }),
    monthDay: safe.toLocaleDateString("en-US", { month: "long", day: "numeric" }),
    monthName: safe.toLocaleDateString("en-US", { month: "long" }),
    monthIndex,
    season: seasonFromMonthIndex(monthIndex),
    isWeekend: dow === 0 || dow === 6,
    isSunday: dow === 0,
  };
}

/** Deterministic (not cryptographic) — stable per seed, spread evenly across a pool. */
export function seededIndex(seed: string, modulo: number): number {
  let hash = 2166136261; // FNV-1a offset basis
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % Math.max(1, modulo);
}

export function usableCity(city: string | null | undefined): string | null {
  const trimmed = city?.trim();
  if (!trimmed || trimmed.toLowerCase() === "your area") return null;
  return trimmed;
}

/** Full region/state names read naturally ("Arizona"); bare codes ("AZ") don't. */
export function usableRegionName(
  region: string | null | undefined,
  state: string | null | undefined
): string | null {
  const candidate = (region ?? state ?? "").trim();
  return candidate.length > 2 ? candidate : null;
}
