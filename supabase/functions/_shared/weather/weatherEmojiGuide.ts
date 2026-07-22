/**
 * Kindred Weather Emoji Guide — server mirror of lib/weather/weatherEmojiGuide.ts
 * Keep in sync — Deno Edge Functions cannot import the React Native module.
 */

export type WeatherConditionKey =
  | "sunny"
  | "mostly_sunny"
  | "partly_cloudy"
  | "mostly_cloudy"
  | "cloudy"
  | "rain"
  | "thunderstorms"
  | "severe_storms"
  | "snow"
  | "fog"
  | "windy";

export type WeatherConditionDisplay = {
  key: WeatherConditionKey;
  emoji: string;
  label: string;
};

export const WEATHER_CONDITION_GUIDE: Record<
  WeatherConditionKey,
  { emoji: string; label: string }
> = {
  sunny: { emoji: "☀️", label: "Sunny" },
  mostly_sunny: { emoji: "🌤️", label: "Mostly Sunny" },
  partly_cloudy: { emoji: "🌤️", label: "Partly Cloudy" },
  mostly_cloudy: { emoji: "⛅", label: "Mostly Cloudy" },
  cloudy: { emoji: "☁️", label: "Cloudy" },
  rain: { emoji: "🌧️", label: "Rain" },
  thunderstorms: { emoji: "⛈️", label: "Thunderstorms" },
  severe_storms: { emoji: "🌩️", label: "Severe Storms" },
  snow: { emoji: "❄️", label: "Snow" },
  fog: { emoji: "🌫️", label: "Fog" },
  windy: { emoji: "💨", label: "Windy" },
};

export const WEATHER_SPECIAL_EMOJI = {
  rainbow: "🌈",
  extremeHeat: "🔥",
  extremeCold: "🥶",
  tornado: "🌪️",
  weatherAlert: "⚠️",
  flood: "🌊",
} as const;

const WINDY_THRESHOLD_MS = 11;

function display(key: WeatherConditionKey): WeatherConditionDisplay {
  const entry = WEATHER_CONDITION_GUIDE[key];
  return { key, emoji: entry.emoji, label: entry.label };
}

export function weatherConditionKeyFromWmo(
  code: number,
  windSpeedMs?: number | null
): WeatherConditionKey | null {
  if (!Number.isFinite(code)) return null;

  const windy =
    windSpeedMs != null &&
    Number.isFinite(windSpeedMs) &&
    windSpeedMs >= WINDY_THRESHOLD_MS;

  if ([95].includes(code)) return "thunderstorms";
  if ([96, 99].includes(code)) return "severe_storms";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return "rain";
  }
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([45, 48].includes(code)) return "fog";
  if ([3].includes(code)) return "cloudy";
  if ([2].includes(code)) return windy ? "windy" : "partly_cloudy";
  if ([1].includes(code)) return windy ? "windy" : "mostly_sunny";
  if ([0].includes(code)) return windy ? "windy" : "sunny";
  return null;
}

export function weatherConditionFromWmoCode(
  code: number | null | undefined,
  windSpeedMs?: number | null
): WeatherConditionDisplay | null {
  if (code == null || !Number.isFinite(code)) return null;
  const key = weatherConditionKeyFromWmo(code, windSpeedMs);
  return key ? display(key) : null;
}

const PHRASE_RULES: Array<{ pattern: RegExp; key: WeatherConditionKey }> = [
  { pattern: /severe storm|severe thunder/i, key: "severe_storms" },
  { pattern: /thunderstorm|thunder/i, key: "thunderstorms" },
  { pattern: /rain|shower|drizzle/i, key: "rain" },
  { pattern: /snow|flurr/i, key: "snow" },
  { pattern: /fog/i, key: "fog" },
  { pattern: /wind|breezy|gust/i, key: "windy" },
  { pattern: /partly cloudy/i, key: "partly_cloudy" },
  { pattern: /mostly clear|mostly sunny/i, key: "mostly_sunny" },
  { pattern: /overcast|cloudy/i, key: "cloudy" },
  { pattern: /clear|sunshine|sunny|plenty of sunshine/i, key: "sunny" },
];

export function weatherConditionFromPhrase(
  phrase: string | null | undefined
): WeatherConditionDisplay | null {
  const text = phrase?.trim();
  if (!text) return null;
  for (const rule of PHRASE_RULES) {
    if (rule.pattern.test(text)) return display(rule.key);
  }
  return null;
}

export type WeatherAlertDisplay = {
  emoji: string;
  label: string;
};

export function weatherAlertCompactDisplay(
  event: string | null | undefined
): WeatherAlertDisplay | null {
  const label = event?.trim();
  if (!label) return null;
  const hay = label.toLowerCase();

  if (/tornado/i.test(hay)) {
    return { emoji: WEATHER_SPECIAL_EMOJI.tornado, label };
  }
  if (/extreme heat|excessive heat|heat warning|heat advisory/i.test(hay)) {
    return { emoji: WEATHER_SPECIAL_EMOJI.extremeHeat, label };
  }
  if (/extreme cold|wind chill|freeze warning|hard freeze/i.test(hay)) {
    return { emoji: WEATHER_SPECIAL_EMOJI.extremeCold, label };
  }
  if (/severe thunderstorm/i.test(hay)) {
    return { emoji: WEATHER_CONDITION_GUIDE.thunderstorms.emoji, label };
  }
  if (/flood/i.test(hay)) {
    return { emoji: WEATHER_SPECIAL_EMOJI.flood, label };
  }
  if (/air quality/i.test(hay)) {
    return { emoji: WEATHER_SPECIAL_EMOJI.weatherAlert, label };
  }
  if (/severe|extreme|warning|watch|emergency/i.test(hay)) {
    return { emoji: WEATHER_SPECIAL_EMOJI.weatherAlert, label };
  }
  return { emoji: WEATHER_SPECIAL_EMOJI.weatherAlert, label };
}
