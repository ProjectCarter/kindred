import { detectHoliday } from "./holidays";
import { placesMatch, resolveLocation } from "./location";
import { getHeroCatalog } from "./catalog";
import type {
  HeroImageAsset,
  HeroImageContext,
  HolidayTag,
  ResolvedLocation,
  ScoredHeroImage,
  Season,
  WeatherTag,
} from "./types";

/** Score gaps enforce the required priority order. */
const SCORE = {
  CITY: 10000,
  METRO: 7000,
  REGION: 4000,
  SEASON: 800,
  WEATHER: 500,
  HOLIDAY: 350,
  MONTH: 120,
  PRIORITY: 1, // asset.priority 0–100
  TYPE_CITY: 40,
  TYPE_METRO: 30,
  TYPE_REGIONAL: 20,
  TYPE_SEASONAL: 10,
  TYPE_HOLIDAY: 15,
  TYPE_GENERIC: 0,
  RECENT_PENALTY: 250,
} as const;

export function parseEditionDate(date?: Date | string | null): Date {
  if (date instanceof Date && !Number.isNaN(date.getTime())) return date;
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date();
}

export function getSeason(month: number): Season {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

export function inferWeatherTag(
  weather?: WeatherTag | null,
  weatherText?: string | null
): WeatherTag | null {
  if (weather) return weather;
  const text = (weatherText ?? "").toLowerCase();
  if (!text) return null;
  if (/(snow|sleet|blizzard|flurries)/.test(text)) return "snow";
  if (/(thunder|storm|severe)/.test(text)) return "storm";
  if (/(rain|shower|drizzle)/.test(text)) return "rain";
  if (/(fog|mist)/.test(text)) return "fog";
  if (/(cloud|overcast)/.test(text)) return "cloudy";
  if (/(hot|heat|humid)/.test(text)) return "hot";
  if (/(cold|chill|freeze|frost)/.test(text)) return "cold";
  if (/(sun|clear|bright|mild|warm|fair)/.test(text)) return "clear";
  return null;
}

function isSnowyAsset(asset: HeroImageAsset): boolean {
  return (
    asset.weatherTags.includes("snow") ||
    /snow|frost|blizzard/i.test(asset.title) ||
    asset.id.includes("winter-snow")
  );
}

/**
 * Hard eligibility — wrong place or impossible season/weather never scores.
 */
export function isEligible(
  asset: HeroImageAsset,
  ctx: {
    location: ResolvedLocation;
    season: Season;
    month: number;
    weather: WeatherTag | null;
    holiday: HolidayTag | null;
  }
): boolean {
  const { location, season, weather } = ctx;

  // City-tagged photographs: exact city only.
  if (asset.city) {
    if (!location.city || !placesMatch(asset.city, location.city)) {
      return false;
    }
  }

  // Metro-tagged photographs: exact metro only (when asset declares metro).
  if (asset.imageType === "metro" && asset.metro) {
    if (!location.metro || !placesMatch(asset.metro, location.metro)) {
      return false;
    }
  }

  // Regional landscapes: require matching region when the reader has one.
  // If the reader has a known region and the asset is regional for another
  // region, exclude (Phoenix must not get PNW mountains).
  if (asset.imageType === "regional" && asset.region) {
    if (location.region && location.region !== asset.region) {
      return false;
    }
  }

  // Anonymous skyline / generic urban: never when we know the reader's city.
  if (
    asset.id === "city-sunrise-generic" &&
    (location.city || location.metro)
  ) {
    return false;
  }

  // Snow / deep winter imagery: only in winter season OR real snow weather.
  if (isSnowyAsset(asset)) {
    const snowOk = season === "winter" || weather === "snow";
    if (!snowOk) return false;
  }

  // If asset declares seasons, prefer eligibility within them —
  // holiday-tagged seasonal art may still appear on that holiday.
  if (asset.season.length > 0 && !asset.season.includes(season)) {
    const holidayOk =
      ctx.holiday && asset.holidayTags.includes(ctx.holiday);
    // Generics may span; seasonals/regionals outside season need holiday or weather bridge.
    if (asset.imageType === "seasonal" && !holidayOk) {
      // Allow winter snow asset already handled; otherwise block off-season seasonal.
      if (!(asset.season.includes("winter") && weather === "snow")) {
        return false;
      }
    }
    if (asset.imageType === "regional" && !holidayOk) {
      // Regional landscapes can appear slightly off-season if months include today
      // or weather strongly matches — otherwise require month overlap.
      if (!asset.month.includes(ctx.month)) {
        return false;
      }
    }
  }

  return true;
}

function scoreAsset(
  asset: HeroImageAsset,
  ctx: {
    location: ResolvedLocation;
    season: Season;
    month: number;
    weather: WeatherTag | null;
    holiday: HolidayTag | null;
    recentImageIds: string[];
  }
): ScoredHeroImage {
  const reasons: string[] = [];
  let score = 0;

  // 1. City
  if (asset.city && placesMatch(asset.city, ctx.location.city)) {
    score += SCORE.CITY;
    reasons.push("city");
  }

  // 2. Metro
  if (asset.metro && placesMatch(asset.metro, ctx.location.metro)) {
    score += SCORE.METRO;
    reasons.push("metro");
  }

  // 3. Region
  if (asset.region && ctx.location.region === asset.region) {
    score += SCORE.REGION;
    reasons.push("region");
  }

  // 4. Season
  if (asset.season.includes(ctx.season)) {
    score += SCORE.SEASON;
    reasons.push("season");
  }

  // 5. Weather
  if (ctx.weather && asset.weatherTags.includes(ctx.weather)) {
    score += SCORE.WEATHER;
    reasons.push("weather");
  }

  // 6. Holiday
  if (ctx.holiday && asset.holidayTags.includes(ctx.holiday)) {
    score += SCORE.HOLIDAY;
    reasons.push("holiday");
  }

  if (asset.month.includes(ctx.month)) {
    score += SCORE.MONTH;
    reasons.push("month");
  }

  score += (asset.priority ?? 0) * SCORE.PRIORITY;

  switch (asset.imageType) {
    case "city":
      score += SCORE.TYPE_CITY;
      break;
    case "metro":
      score += SCORE.TYPE_METRO;
      break;
    case "regional":
      score += SCORE.TYPE_REGIONAL;
      break;
    case "seasonal":
      score += SCORE.TYPE_SEASONAL;
      break;
    case "holiday":
      score += SCORE.TYPE_HOLIDAY;
      break;
    default:
      score += SCORE.TYPE_GENERIC;
  }

  // Generic seasonal only as final fallback — keep generics behind place-aware art.
  if (asset.imageType === "generic") {
    score -= 50;
  }

  const recentIndex = ctx.recentImageIds.indexOf(asset.id);
  if (recentIndex !== -1) {
    // More recent → heavier penalty
    score -= SCORE.RECENT_PENALTY * (ctx.recentImageIds.length - recentIndex);
    reasons.push("rotation-penalty");
  }

  return { asset, score, reasons };
}

function daySeed(date: Date): number {
  return (
    date.getFullYear() * 1000 +
    (date.getMonth() + 1) * 50 +
    date.getDate()
  );
}

/**
 * Among near-tied top scores, rotate deterministically by date
 * so the library feels alive without randomness flicker on re-render.
 */
function pickWithRotation(
  scored: ScoredHeroImage[],
  date: Date
): HeroImageAsset | null {
  if (!scored.length) return null;
  const best = scored[0].score;
  // Candidates within a small band of the best score
  const band = scored.filter((s) => best - s.score <= 80);
  const pool = band.length > 0 ? band : [scored[0]];
  const index = daySeed(date) % pool.length;
  return pool[index]?.asset ?? scored[0].asset;
}

export function scoreHeroCatalog(
  context: HeroImageContext = {},
  catalog: HeroImageAsset[] = getHeroCatalog()
): ScoredHeroImage[] {
  const date = parseEditionDate(context.date);
  const month = date.getMonth() + 1;
  const season = getSeason(month);
  const holiday = detectHoliday(date, context.birthdayMMDD);
  const weather = inferWeatherTag(context.weather, context.weatherText);
  const location = resolveLocation(context.location);
  const recentImageIds = context.recentImageIds ?? [];

  const ctx = { location, season, month, weather, holiday, recentImageIds };

  return catalog
    .filter((asset) => isEligible(asset, ctx))
    .map((asset) => scoreAsset(asset, ctx))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.asset.priority - a.asset.priority ||
        a.asset.id.localeCompare(b.asset.id)
    );
}

/**
 * Choose today’s editorial hero.
 * Order of intent: city → metro → region → season → weather → holiday → generic.
 */
export function selectHeroImage(
  context: HeroImageContext = {},
  catalog: HeroImageAsset[] = getHeroCatalog()
): HeroImageAsset | null {
  if (!catalog.length) return null;

  try {
    const date = parseEditionDate(context.date);
    const scored = scoreHeroCatalog(context, catalog);

    if (scored.length > 0) {
      return pickWithRotation(scored, date);
    }

    // Absolute fallback — never leave the masthead empty if catalog exists.
    return (
      catalog.find((a) => a.id === "default-morning") ??
      catalog.find((a) => a.imageType === "generic") ??
      catalog[0] ??
      null
    );
  } catch {
    return (
      catalog.find((a) => a.id === "default-morning") ?? catalog[0] ?? null
    );
  }
}
