/** Homepage weather emoji + short label — grounded in WMO / summary phrases only. */

export type HomepageWeatherCondition = {
  emoji: string;
  label: string;
};

const PHRASE_LABELS: Array<{ pattern: RegExp; emoji: string; label: string }> =
  [
    {
      pattern: /thunderstorm/i,
      emoji: "⛈️",
      label: "Thunderstorms",
    },
    {
      pattern: /rain|shower|drizzle/i,
      emoji: "🌦️",
      label: "Light rain",
    },
    {
      pattern: /snow|flurr/i,
      emoji: "🌨️",
      label: "Snow",
    },
    {
      pattern: /fog/i,
      emoji: "🌫️",
      label: "Foggy",
    },
    {
      pattern: /partly cloudy/i,
      emoji: "⛅",
      label: "Partly cloudy",
    },
    {
      pattern: /mostly clear|mostly sunny/i,
      emoji: "🌤️",
      label: "Mostly sunny",
    },
    {
      pattern: /overcast|cloudy/i,
      emoji: "☁️",
      label: "Cloudy",
    },
    {
      pattern: /clear|sunshine|sunny/i,
      emoji: "☀️",
      label: "Clear skies",
    },
  ];

export function homepageConditionFromPhrase(
  phrase: string | null | undefined
): HomepageWeatherCondition | null {
  const text = phrase?.trim();
  if (!text) return null;
  for (const entry of PHRASE_LABELS) {
    if (entry.pattern.test(text)) {
      return { emoji: entry.emoji, label: entry.label };
    }
  }
  return null;
}

export function homepageConditionFromCode(
  code: number | null | undefined
): HomepageWeatherCondition | null {
  if (code == null || !Number.isFinite(code)) return null;
  if (code === 0) return { emoji: "☀️", label: "Clear skies" };
  if (code === 1) return { emoji: "🌤️", label: "Mostly sunny" };
  if (code === 2) return { emoji: "⛅", label: "Partly cloudy" };
  if (code === 3) return { emoji: "☁️", label: "Cloudy" };
  if (code === 45 || code === 48) return { emoji: "🌫️", label: "Foggy" };
  if ([51, 53, 55, 56, 57].includes(code)) {
    return { emoji: "🌦️", label: "Light rain" };
  }
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return { emoji: "🌦️", label: "Light rain" };
  }
  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return { emoji: "🌨️", label: "Snow" };
  }
  if ([95, 96, 99].includes(code)) {
    return { emoji: "⛈️", label: "Thunderstorms" };
  }
  return null;
}
