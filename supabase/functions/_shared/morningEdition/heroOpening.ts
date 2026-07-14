// Kindred — hero opening (the line beneath the front-page hero image)
//
// Deliberately NOT AI-written. However carefully prompted, an LLM opener
// kept drifting toward "Inside this morning's edition..." / "the rhythm
// shifts..." summary phrasing, or overly dramatic words ("scorching") —
// language that competes with the front page instead of stepping aside for
// it. A small, handcrafted template library — rotated deterministically per
// reader per day — reads calmer and never summarizes the stories inside.
//
// Selection is seeded by (userId, editionDate), so the line is stable for
// a given reader on a given day (no flicker on reload/resume) but varies
// day to day and reader to reader.

import type { MorningBriefing } from "./types.ts";
import { weatherConditionPhrase } from "../weather/units.ts";
import {
  editionDateParts,
  moodFromTempC,
  seasonalMoodWord,
  seededIndex,
  usableCity,
  usableRegionName,
  type Season,
  type WeatherMood,
} from "../editorialTemplates.ts";

export type HeroOpeningInput = {
  editionDate: string; // YYYY-MM-DD
  userId: string;
  location: {
    city: string | null;
    region?: string | null;
    state?: string | null;
  };
  /** Raw facts only — never AI-written prose. */
  weather?: {
    currentTempC: number | null;
    conditionCode: number | null;
  } | null;
  readerFirstName?: string | null;
};

type Ctx = {
  dayName: string;
  monthDay: string;
  monthName: string;
  season: Season;
  seasonWord: string;
  city: string | null;
  regionName: string | null;
  firstName: string | null;
  mood: WeatherMood | null;
  skyPhrase: string | null;
  skyIsClear: boolean;
  isWeekend: boolean;
};

type Need = "city" | "weather" | "sky" | "region" | "name" | "clearSky" | "spring" | "coolSeason";

type Template = {
  id: string;
  weekendOnly?: boolean;
  needs?: Need[];
  render: (ctx: Ctx) => string;
};

function has(ctx: Ctx, need: Need): boolean {
  switch (need) {
    case "city":
      return Boolean(ctx.city);
    case "weather":
      return Boolean(ctx.mood);
    case "sky":
      return Boolean(ctx.skyPhrase);
    case "region":
      return Boolean(ctx.regionName) && Boolean(ctx.mood);
    case "name":
      return Boolean(ctx.firstName);
    case "clearSky":
      return Boolean(ctx.city) && ctx.skyIsClear;
    case "spring":
      return ctx.season === "spring";
    case "coolSeason":
      return ctx.season === "winter" || ctx.season === "autumn";
    default:
      return true;
  }
}

// ~50 handcrafted openers — max two short sentences each, calm and
// understated (no "scorching", no story summaries, no "Inside this
// edition..." style AI phrasing). Every template mentions the day
// naturally; city, region, weather, and season are used only where they
// fit — most readers see a mix of all-of-the-above and none-of-the-above
// across different days.
const TEMPLATES: Template[] = [
  // Plain — always available, no city/weather required.
  { id: "p1", render: (c) => `Good morning. Your ${c.dayName} edition is ready.` },
  { id: "p2", render: () => "Good morning. Today's paper is ready when you are." },
  { id: "p3", render: (c) => `${c.dayName}'s paper is ready. Enjoy your morning.` },
  { id: "p4", render: (c) => `Welcome back. ${c.dayName}'s edition is here.` },
  { id: "p5", render: () => "Good morning. Let's see what's happening today." },
  { id: "p6", render: () => "Good morning. Coffee's brewing and today's edition is waiting." },
  { id: "p7", render: (c) => `Here's your ${c.dayName} morning, all laid out.` },
  { id: "p8", render: () => "Good morning. Today's edition awaits." },
  { id: "p9", render: (c) => `${c.dayName} morning. Your paper's on the porch.` },
  { id: "p10", render: (c) => `Good morning. Fresh off the press for ${c.dayName}.` },
  { id: "p11", render: (c) => `Welcome in. ${c.dayName}'s paper is ready for you.` },
  { id: "p12", render: (c) => `Good morning, and welcome to ${c.dayName}.` },
  { id: "p13", render: (c) => `Take a seat. ${c.dayName}'s paper is ready.` },
  { id: "p14", render: (c) => `Good morning. A new ${c.dayName} edition, just for you.` },
  { id: "p15", render: (c) => `It's ${c.dayName}. Your paper's ready whenever you are.` },
  { id: "p16", render: (c) => `${c.dayName}, ${c.monthDay}. Your Kindred edition is ready.` },
  { id: "p17", render: (c) => `${c.dayName}, ${c.monthDay}. Here's your paper.` },
  { id: "p18", render: (c) => `${c.dayName}, ${c.monthDay}. Another day, another good read.` },
  { id: "p19", render: (c) => `Good morning. It's ${c.dayName}, ${c.monthDay}.` },
  { id: "p20", render: (c) => `${c.dayName}'s edition is ready.` },
  { id: "p21", render: () => "Your morning edition is ready." },

  // City-only.
  { id: "c1", needs: ["city"], render: (c) => `Good morning. Another day begins in ${c.city}.` },
  { id: "c2", needs: ["city"], render: (c) => `${c.dayName} morning in ${c.city}. Your paper is ready.` },
  { id: "c3", needs: ["city"], render: (c) => `Good morning from ${c.city}. Today's edition is here.` },
  { id: "c4", needs: ["city"], render: (c) => `${c.dayName} in ${c.city}. Let's get you caught up.` },
  { id: "c5", needs: ["city"], render: (c) => `Good morning, ${c.city}. Here's your ${c.dayName} paper.` },
  { id: "c6", needs: ["city"], render: (c) => `Another ${c.dayName} in ${c.city}. Your paper's ready.` },

  // Weather + city.
  { id: "wc1", needs: ["city", "weather"], render: (c) => `${c.dayName}, ${c.monthDay}. Another ${c.mood} day in ${c.city}.` },
  { id: "wc2", needs: ["city", "weather"], render: (c) => `Good morning. A ${c.mood} ${c.dayName} ahead in ${c.city}.` },
  { id: "wc3", needs: ["city", "weather"], render: (c) => `Another ${c.mood} ${c.dayName} in ${c.city}. Your paper's ready.` },
  { id: "wc4", needs: ["city", "weather"], render: (c) => `Good morning, ${c.city}. Expect a ${c.mood} ${c.dayName}.` },
  { id: "wc5", needs: ["city", "weather"], render: (c) => `${c.dayName} morning. Another ${c.mood} day across ${c.city}.` },
  { id: "wc6", needs: ["city", "weather"], render: (c) => `${c.dayName}, ${c.monthDay}. Another ${c.mood} ${c.monthName} day in ${c.city}.` },
  { id: "wc7", needs: ["city", "weather"], render: (c) => `Good morning. Another ${c.mood} ${c.monthName} day in ${c.city}.` },

  // Weather-only.
  { id: "w1", needs: ["weather"], render: (c) => `Good morning. A ${c.mood} ${c.dayName} out there — here's your paper.` },
  { id: "w2", needs: ["weather"], render: (c) => `Good morning. Clear skies, ${c.mood} weather, and today's paper.` },
  { id: "w3", needs: ["sky"], render: (c) => `Good morning. Expect ${c.skyPhrase} today — your paper's ready.` },
  { id: "w4", needs: ["weather"], render: (c) => `It's ${c.dayName}, and ${c.mood} weather to go with it.` },

  // Region/state.
  { id: "r1", needs: ["region"], render: (c) => `${c.dayName}, ${c.monthDay}. Another ${c.mood} ${c.regionName} morning.` },
  { id: "r2", needs: ["region"], render: (c) => `Good morning. Another ${c.mood} morning across ${c.regionName}.` },

  // Month name + city (no full date).
  { id: "m1", needs: ["city"], render: (c) => `Another ${c.monthName} morning in ${c.city}. Your edition is ready.` },
  { id: "m2", needs: ["city"], render: (c) => `Good morning. Another ${c.monthName} day in ${c.city}.` },

  // Clear-sky city.
  { id: "b1", needs: ["clearSky"], render: (c) => `Good morning. Another beautiful day begins in ${c.city}.` },
  { id: "b2", needs: ["clearSky"], render: (c) => `Good morning. A beautiful ${c.dayName} is starting in ${c.city}.` },

  // Seasonal — always available (season is always known; seasonWord has a
  // sensible default even without live weather).
  { id: "s1", render: (c) => `A ${c.seasonWord} ${c.monthName} morning.` },
  { id: "s2", needs: ["spring"], render: () => "Another beautiful spring morning." },
  { id: "s3", needs: ["coolSeason"], render: (c) => `A crisp ${c.monthName} morning.` },
  { id: "s4", render: (c) => `${c.dayName}, ${c.monthDay}. A ${c.seasonWord} ${c.season} morning.` },
  { id: "s5", needs: ["city"], render: (c) => `A ${c.seasonWord} ${c.monthName} morning in ${c.city}.` },
  { id: "s6", needs: ["weather"], render: (c) => `A ${c.mood} ${c.monthName} morning.` },

  // Weekend-only.
  { id: "wk1", weekendOnly: true, render: (c) => `Good morning. A slower ${c.dayName} for reading, coffee in hand.` },
  { id: "wk2", weekendOnly: true, render: (c) => `It's ${c.dayName}. No rush — today's paper is ready.` },
  { id: "wk3", weekendOnly: true, render: (c) => `Happy ${c.dayName}. Take your time with this one.` },

  // Personalized.
  { id: "n1", needs: ["name"], render: (c) => `Good morning, ${c.firstName}. Your ${c.dayName} edition is ready.` },
  { id: "n2", needs: ["name"], render: (c) => `Morning, ${c.firstName}. Today's paper is waiting for you.` },
];

function isEligible(t: Template, ctx: Ctx): boolean {
  if (t.weekendOnly && !ctx.isWeekend) return false;
  if (!t.needs) return true;
  return t.needs.every((n) => has(ctx, n));
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function composeHeroOpening(input: HeroOpeningInput): MorningBriefing {
  const { dayName, monthDay, monthName, season, isWeekend } = editionDateParts(
    input.editionDate
  );

  const city = usableCity(input.location.city);
  const regionName = usableRegionName(input.location.region, input.location.state);
  const firstName = input.readerFirstName?.trim() || null;

  const conditionCode = input.weather?.conditionCode ?? null;
  const currentTempC = input.weather?.currentTempC ?? null;
  const mood = currentTempC != null ? moodFromTempC(currentTempC) : null;
  const skyPhrase = weatherConditionPhrase(conditionCode);
  const skyIsClear = conditionCode === 0 || conditionCode === 1 || conditionCode === 2;
  const seasonWord = seasonalMoodWord(season, mood, skyIsClear);

  const ctx: Ctx = {
    dayName,
    monthDay,
    monthName,
    season,
    seasonWord,
    city,
    regionName,
    firstName,
    mood,
    skyPhrase,
    skyIsClear,
    isWeekend,
  };

  const eligible = TEMPLATES.filter((t) => isEligible(t, ctx));
  // Always non-empty — the "plain" templates carry no requirements.
  const pool = eligible.length > 0 ? eligible : TEMPLATES.filter((t) => !t.needs && !t.weekendOnly);
  const index = seededIndex(`${input.userId}|${input.editionDate}`, pool.length);
  const chosen = pool[index] ?? pool[0];
  const text = chosen.render(ctx).replace(/\s+/g, " ").trim();

  return {
    length: "opening_20s",
    text,
    paragraphs: [text],
    estimatedSeconds: 8,
    wordCount: wordCount(text),
  };
}
