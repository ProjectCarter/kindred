/**
 * Parse Kindred's deterministic weather summary string.
 * Mirrors supabase/functions/_shared/weather/units.ts formatWeatherSummary output.
 */

export type ParsedWeatherSummary = {
  currentLabel: string | null;
  highLabel: string | null;
  lowLabel: string | null;
  conditionPhrase: string | null;
};

const SUMMARY_RE =
  /^Current\s+([\d.]+°[CF])\s+in\s+[^;]+(?:;\s*high\s+([\d.]+°[CF])\s*\/\s*low\s+([\d.]+°[CF]))?(?:;\s*([^;.]+?))?\.?$/i;

const NATURALIZED_HIGH_LOW_RE =
  /Expect a high near ([\d.]+°[CF]) and a low near ([\d.]+°[CF])/i;

const NATURALIZED_CURRENT_RE = /Currently ([\d.]+°[CF])/i;

const WITH_CONDITION_RE = /(?:with|,\s*with)\s+(.+?)\.?$/i;

function toDegreeDisplay(label: string | null | undefined): string | null {
  if (!label?.trim()) return null;
  const match = /^([\d.]+)°[CF]?$/i.exec(label.trim());
  if (!match) return label.trim();
  const rounded = Math.round(Number(match[1]));
  if (!Number.isFinite(rounded)) return null;
  return `${rounded}°`;
}

export function parseWeatherSummaryText(
  summary: string | null | undefined
): ParsedWeatherSummary | null {
  const text = summary?.trim();
  if (!text) return null;

  const direct = SUMMARY_RE.exec(text);
  if (direct) {
    return {
      currentLabel: toDegreeDisplay(direct[1]),
      highLabel: toDegreeDisplay(direct[2]),
      lowLabel: toDegreeDisplay(direct[3]),
      conditionPhrase: direct[4]?.trim() || null,
    };
  }

  const highLow = NATURALIZED_HIGH_LOW_RE.exec(text);
  const current = NATURALIZED_CURRENT_RE.exec(text);
  const condition = WITH_CONDITION_RE.exec(text);

  if (!highLow && !current) return null;

  return {
    currentLabel: toDegreeDisplay(current?.[1] ?? null),
    highLabel: toDegreeDisplay(highLow?.[1] ?? null),
    lowLabel: toDegreeDisplay(highLow?.[2] ?? null),
    conditionPhrase: condition?.[1]?.trim() || null,
  };
}

/** Short hero tag fallback — e.g. "Clear skies • 103°". */
export function parseHeroWeatherTag(
  tag: string | null | undefined
): ParsedWeatherSummary | null {
  const text = tag?.trim();
  if (!text) return null;

  const tempMatch = /([\d.]+)°/.exec(text);
  const currentLabel = tempMatch ? toDegreeDisplay(`${tempMatch[1]}°`) : null;

  let conditionPhrase: string | null = null;
  if (/clear skies/i.test(text)) conditionPhrase = "clear skies";
  else if (/sunny/i.test(text)) conditionPhrase = "sunny";
  else if (/partly cloudy/i.test(text)) conditionPhrase = "partly cloudy";
  else if (/cloudy|overcast/i.test(text)) conditionPhrase = "cloudy";
  else if (/rain|drizzle|shower/i.test(text)) conditionPhrase = "rain";
  else if (/storm/i.test(text)) conditionPhrase = "thunderstorms";
  else if (/snow/i.test(text)) conditionPhrase = "snow";

  if (!currentLabel && !conditionPhrase) return null;

  return {
    currentLabel,
    highLabel: null,
    lowLabel: null,
    conditionPhrase,
  };
}

export function extractWeatherSummaryFromEditorialContext(
  value: unknown
): string | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { weatherSummary?: unknown };
  return typeof raw.weatherSummary === "string"
    ? raw.weatherSummary.trim() || null
    : null;
}
