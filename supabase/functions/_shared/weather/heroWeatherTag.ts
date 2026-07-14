// Kindred — hero weather tag (the short line next to the city under the
// hero image, e.g. "Gilbert · 103° this afternoon")
//
// Deliberately NOT AI-written. The AI weather sentence kept naming the city
// inside its own sentence even though the client already prefixes the city
// label, producing "Gilbert · Gilbert sits at 103°F this afternoon under
// plenty of sunshine..." — a full sentence doing a newspaper tag line's
// job. This never mentions the city (the client already shows it) and is
// capped at 5-8 words by construction.
//
// Uses the day's forecast high, not the instant-of-generation "current"
// reading — the edition is built once, hours before a reader might open it,
// so "current" temperature is stale by the time they look. The forecast
// high stays accurate all day.

import { seededIndex, shortSky, editionDateParts, moodFromTempC } from "../editorialTemplates.ts";
import type { TemperatureUnit } from "./units.ts";

export type HeroWeatherTagInput = {
  editionDate: string;
  userId: string;
  /** Day's forecast high, Celsius — falls back to "current" if high is unavailable. */
  highC: number | null;
  currentC: number | null;
  conditionCode: number | null;
  unit: TemperatureUnit;
};

function convert(valueC: number, unit: TemperatureUnit): number {
  return unit === "fahrenheit" ? Math.round((valueC * 9) / 5 + 32) : Math.round(valueC);
}

type Ctx = {
  temp: number | null;
  monthName: string;
  season: string;
  mood: ReturnType<typeof moodFromTempC> | null;
  sky: ReturnType<typeof shortSky>;
};

type Need = "temp" | "mood" | "sky" | "clearSky";

type Template = {
  id: string;
  needs: Need[];
  render: (ctx: Ctx) => string;
};

function has(ctx: Ctx, need: Need): boolean {
  switch (need) {
    case "temp":
      return ctx.temp != null;
    case "mood":
      return Boolean(ctx.mood);
    case "sky":
      return Boolean(ctx.sky);
    case "clearSky":
      return Boolean(ctx.sky?.isClear);
    default:
      return true;
  }
}

// Every template is 5-8 words and never mentions a city — the client
// already shows "{city} · {this tag}" so repeating it here would duplicate.
const TEMPLATES: Template[] = [
  { id: "t1", needs: ["temp"], render: (c) => `${c.temp}° this afternoon` },
  { id: "t2", needs: ["temp"], render: (c) => `High near ${c.temp}° today` },
  { id: "t3", needs: ["temp", "sky"], render: (c) => `${c.sky!.short} • ${c.temp}°` },
  { id: "t4", needs: ["temp", "clearSky"], render: (c) => `Clear skies • ${c.temp}°` },
  { id: "t5", needs: ["mood"], render: (c) => `${cap(c.mood!)} ${c.monthName} afternoon` },
  { id: "t6", needs: ["mood"], render: (c) => `${cap(c.mood!)} ${c.season} day` },
  { id: "t7", needs: ["mood", "sky"], render: (c) => `${cap(c.mood!)} and ${c.sky!.adj}` },
  { id: "t8", needs: ["temp", "sky"], render: (c) => `${c.temp}° and ${c.sky!.adj}` },
  { id: "t9", needs: ["sky"], render: (c) => `${c.sky!.short} afternoon` },
  { id: "t10", needs: ["mood"], render: (c) => `Another ${c.mood} day ahead` },
  { id: "t11", needs: ["mood", "sky"], render: (c) => `${c.sky!.short} • ${cap(c.mood!)}` },
  { id: "t12", needs: ["temp"], render: (c) => `Today's high: ${c.temp}°` },
];

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function isEligible(t: Template, ctx: Ctx): boolean {
  return t.needs.every((n) => has(ctx, n));
}

/** Returns null when there's no usable weather data — no section is written, same as before. */
export function composeHeroWeatherTag(input: HeroWeatherTagInput): string | null {
  const rawC = input.highC ?? input.currentC;
  if (rawC == null || !Number.isFinite(rawC)) return null;

  const temp = convert(rawC, input.unit);
  const { monthName, season } = editionDateParts(input.editionDate);
  const mood = moodFromTempC(rawC);
  const sky = shortSky(input.conditionCode);

  const ctx: Ctx = { temp, monthName, season, mood, sky };

  const eligible = TEMPLATES.filter((t) => isEligible(t, ctx));
  // "temp" alone is always satisfiable here (guarded above), so this is never empty.
  const pool = eligible.length > 0 ? eligible : TEMPLATES.filter((t) => t.needs.length === 1 && t.needs[0] === "temp");
  const index = seededIndex(`weather|${input.userId}|${input.editionDate}`, pool.length);
  const chosen = pool[index] ?? pool[0];
  return chosen.render(ctx).replace(/\s+/g, " ").trim();
}
