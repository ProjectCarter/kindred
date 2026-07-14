// Kindred — Bandit's weather-aware morning line
//
// Deliberately NOT AI-polished. The AI polish pass kept drifting into
// literary/poetic territory ("The desert heat holds steady at 103° today —
// a good morning to find shade and let the world come to you.") — Bandit
// is meant to sound like a thoughtful friend leaving a short note, not a
// nature writer. This is one short sentence, deterministically rotated per
// reader per day, and never invents raw numbers the reader hasn't already
// seen on the front page.
//
// Occasion-aware lines (birthday, travel, holidays, season turns, weekly
// picks) stay in compose.ts — those are already personal and good. This
// only replaces the generic weather/no-occasion fallback that used to lean
// on the AI.

import { seededIndex, type WeatherMood } from "../editorialTemplates.ts";

export type BanditWeatherLineInput = {
  editionDate: string;
  userId: string;
  mood: WeatherMood | null;
  hasLocalEvents?: boolean;
};

const HOT_LINES = [
  "Stay cool today.",
  "Find some shade today.",
  "Drink some water out there today.",
  "Take it easy in the heat today.",
];

const WARM_LINES = [
  "Another warm one today.",
  "Good weather for being outside today.",
  "A pleasant day to step outside.",
];

const MILD_LINES = [
  "Comfortable weather today.",
  "A nice day to get outside.",
  "Mild weather — a good day for a walk.",
];

const COOL_LINES = [
  "Grab a jacket today.",
  "A bit cool out there today.",
  "Cool air today — perfect for coffee.",
];

const COLD_LINES = [
  "Bundle up today.",
  "Cold out there — stay warm.",
  "The paper will keep you warm today.",
];

const GENERIC_LINES = [
  "Hope today's a good one.",
  "Enjoy today's edition.",
  "I left the paper open for you.",
  "Glad you're here this morning.",
  "Take your time with today's paper.",
  "Here's hoping for a good one today.",
];

const EVENTS_LINES = [
  "I noticed a few things nearby you might like.",
  "A few local notes caught my eye today.",
  "Worth a look — a few things happening nearby.",
];

function pool(mood: WeatherMood | null): string[] {
  switch (mood) {
    case "hot":
      return HOT_LINES;
    case "warm":
      return WARM_LINES;
    case "mild":
      return MILD_LINES;
    case "cool":
      return COOL_LINES;
    case "cold":
      return COLD_LINES;
    default:
      return GENERIC_LINES;
  }
}

/**
 * One short sentence — never two, never a raw temperature, never
 * exclamation points. Weather-mood aware when data is available; a
 * generic, still-warm fallback otherwise.
 */
export function composeBanditWeatherLine(input: BanditWeatherLineInput): string {
  const lines = input.hasLocalEvents ? EVENTS_LINES : pool(input.mood);
  const index = seededIndex(`bandit|${input.userId}|${input.editionDate}`, lines.length);
  return lines[index] ?? lines[0];
}
