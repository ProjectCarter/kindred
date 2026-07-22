/** Homepage weather emoji + label — delegates to the Kindred Weather Emoji Guide. */

import {
  weatherConditionFromPhrase,
  weatherConditionFromWmoCode,
  type WeatherConditionDisplay,
} from "./weatherEmojiGuide.ts";

export type HomepageWeatherCondition = WeatherConditionDisplay;

export function homepageConditionFromPhrase(
  phrase: string | null | undefined
): HomepageWeatherCondition | null {
  return weatherConditionFromPhrase(phrase);
}

export function homepageConditionFromCode(
  code: number | null | undefined,
  windSpeedMs?: number | null
): HomepageWeatherCondition | null {
  return weatherConditionFromWmoCode(code, windSpeedMs);
}
