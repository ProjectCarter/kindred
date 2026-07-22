/**
 * Canonical Kindred weather conditions — provider-agnostic display layer.
 * Server mirror of lib/weather/canonicalCondition.ts
 */

import type { WeatherConditionDisplay, WeatherConditionKey } from "./weatherEmojiGuide.ts";
import { WEATHER_CONDITION_GUIDE } from "./weatherEmojiGuide.ts";

export type KindredCanonicalCondition =
  | "clear"
  | "mostly_clear"
  | "partly_cloudy"
  | "mostly_cloudy"
  | "cloudy"
  | "fog"
  | "rain"
  | "thunderstorms"
  | "snow"
  | "wind"
  | "severe";

export type CanonicalConditionResolution = {
  canonicalCondition: KindredCanonicalCondition;
  emoji: string;
  label: string;
  /** WMO-compatible internal code for legacy edition paths. */
  rawInternalCode: number;
  mappingSource: string;
  conflictLogged?: boolean;
};

const WINDY_THRESHOLD_MS = 11;

const NIGHT_EMOJI: Partial<Record<KindredCanonicalCondition, string>> = {
  clear: "🌙",
  mostly_clear: "🌙",
  partly_cloudy: "☁️",
  mostly_cloudy: "☁️",
};

export function guideKeyFromCanonical(
  canonical: KindredCanonicalCondition
): WeatherConditionKey {
  return canonicalToGuideKey(canonical);
}

function canonicalToGuideKey(
  canonical: KindredCanonicalCondition
): WeatherConditionKey {
  switch (canonical) {
    case "clear":
      return "sunny";
    case "mostly_clear":
      return "mostly_sunny";
    case "partly_cloudy":
      return "partly_cloudy";
    case "mostly_cloudy":
      return "mostly_cloudy";
    case "cloudy":
      return "cloudy";
    case "fog":
      return "fog";
    case "rain":
      return "rain";
    case "thunderstorms":
      return "thunderstorms";
    case "severe":
      return "severe_storms";
    case "snow":
      return "snow";
    case "wind":
      return "windy";
  }
}

function wmoForCanonical(canonical: KindredCanonicalCondition): number {
  switch (canonical) {
    case "clear":
      return 0;
    case "mostly_clear":
      return 1;
    case "partly_cloudy":
      return 2;
    case "mostly_cloudy":
      return 2;
    case "cloudy":
      return 3;
    case "fog":
      return 45;
    case "rain":
      return 61;
    case "thunderstorms":
      return 95;
    case "severe":
      return 96;
    case "snow":
      return 71;
    case "wind":
      return 0;
  }
}

function displayForCanonical(
  canonical: KindredCanonicalCondition,
  isDaytime: boolean
): { emoji: string; label: string } {
  const key = canonicalToGuideKey(canonical);
  const guide = WEATHER_CONDITION_GUIDE[key];
  const nightEmoji = !isDaytime ? NIGHT_EMOJI[canonical] : null;
  return {
    emoji: nightEmoji ?? guide.emoji,
    label: guide.label,
  };
}

function descriptionSuggestsClear(description: string): boolean {
  return /clear sky|sunny|fair/i.test(description);
}

function descriptionSuggestsFewClouds(description: string): boolean {
  return /few clouds|mostly clear|mostly sunny/i.test(description);
}

function descriptionSuggestsPartlyCloudy(description: string): boolean {
  return /scattered clouds|partly cloudy|partly cloud/i.test(description);
}

function descriptionSuggestsBrokenClouds(description: string): boolean {
  return /broken clouds/i.test(description);
}

function descriptionSuggestsOvercast(description: string): boolean {
  return /overcast clouds|overcast/i.test(description);
}

/** Primary mapping from OpenWeather condition ID — no cloud-percentage input. */
function canonicalFromOpenWeatherId(
  id: number,
  windy: boolean
): { canonical: KindredCanonicalCondition; mappingSource: string } {
  if (id >= 200 && id <= 212) {
    return {
      canonical: id >= 202 ? "severe" : "thunderstorms",
      mappingSource: "openweather_storm_id",
    };
  }
  if (id >= 300 && id <= 321) {
    return { canonical: "rain", mappingSource: "openweather_drizzle_id" };
  }
  if (id >= 500 && id <= 504) {
    return { canonical: "rain", mappingSource: "openweather_rain_id" };
  }
  if (id === 511 || (id >= 520 && id <= 531)) {
    return { canonical: "rain", mappingSource: "openweather_shower_id" };
  }
  if (id >= 600 && id <= 622) {
    return { canonical: "snow", mappingSource: "openweather_snow_id" };
  }
  if (id >= 701 && id <= 781) {
    return {
      canonical: id === 771 || (windy && id === 781) ? "wind" : "fog",
      mappingSource: "openweather_atmosphere_id",
    };
  }
  if (id === 800) {
    return {
      canonical: windy ? "wind" : "clear",
      mappingSource: "openweather_id",
    };
  }
  if (id === 801) {
    return {
      canonical: windy ? "wind" : "mostly_clear",
      mappingSource: "openweather_id",
    };
  }
  if (id === 802) {
    return {
      canonical: windy ? "wind" : "partly_cloudy",
      mappingSource: "openweather_id",
    };
  }
  if (id === 803) {
    return {
      canonical: windy ? "wind" : "mostly_cloudy",
      mappingSource: "openweather_id",
    };
  }
  if (id === 804) {
    return {
      canonical: windy ? "wind" : "cloudy",
      mappingSource: "openweather_id",
    };
  }
  return {
    canonical: windy ? "wind" : "cloudy",
    mappingSource: "openweather_unknown_id_fallback",
  };
}

/** Priority 2 — refine only when description clearly disagrees with ID bucket. */
function refineFromDescription(
  id: number,
  description: string,
  canonical: KindredCanonicalCondition
): { canonical: KindredCanonicalCondition; mappingSource: string } | null {
  if (!description) return null;

  if (descriptionSuggestsClear(description) && id !== 800) {
    return { canonical: "clear", mappingSource: "description_override" };
  }
  if (descriptionSuggestsFewClouds(description) && id >= 802) {
    return { canonical: "mostly_clear", mappingSource: "description_override" };
  }
  if (descriptionSuggestsPartlyCloudy(description) && (id === 803 || id === 804)) {
    return { canonical: "partly_cloudy", mappingSource: "description_override" };
  }
  if (descriptionSuggestsBrokenClouds(description) && id === 804) {
    return { canonical: "mostly_cloudy", mappingSource: "description_confirm" };
  }
  if (descriptionSuggestsOvercast(description) && id === 803) {
    return { canonical: "mostly_cloudy", mappingSource: "description_confirm" };
  }
  if (
    descriptionSuggestsOvercast(description) &&
    canonical !== "cloudy" &&
    id === 804
  ) {
    return { canonical: "cloudy", mappingSource: "description_confirm" };
  }
  return null;
}

export function resolveOpenWeatherCanonicalCondition(input: {
  providerConditionId: number;
  providerMain?: string | null;
  providerDescription?: string | null;
  cloudPercentage?: number | null;
  isDaytime: boolean;
  windSpeedMs?: number | null;
}): CanonicalConditionResolution {
  const id = input.providerConditionId;
  const description = (input.providerDescription ?? "").trim();
  const main = (input.providerMain ?? "").trim();
  const clouds = input.cloudPercentage;
  const windy =
    input.windSpeedMs != null &&
    Number.isFinite(input.windSpeedMs) &&
    input.windSpeedMs >= WINDY_THRESHOLD_MS;

  let { canonical, mappingSource } = canonicalFromOpenWeatherId(id, windy);
  let conflictLogged = false;

  const descriptionRefinement = refineFromDescription(id, description, canonical);
  if (descriptionRefinement) {
    if (descriptionRefinement.canonical !== canonical) {
      conflictLogged = true;
      console.warn("[weather:condition] provider/description conflict", {
        providerConditionId: id,
        providerMain: main,
        providerDescription: description,
        cloudPercentage: clouds,
        idMapped: canonical,
        resolved: descriptionRefinement.canonical,
        mappingSource: descriptionRefinement.mappingSource,
      });
    }
    canonical = descriptionRefinement.canonical;
    mappingSource = descriptionRefinement.mappingSource;
  }

  const display = displayForCanonical(canonical, input.isDaytime);
  return {
    canonicalCondition: canonical,
    emoji: display.emoji,
    label: display.label,
    rawInternalCode: wmoForCanonical(canonical),
    mappingSource,
    conflictLogged: conflictLogged || undefined,
  };
}

export function displayFromCanonicalResolution(
  resolution: CanonicalConditionResolution
): WeatherConditionDisplay {
  const key = canonicalToGuideKey(resolution.canonicalCondition);
  return {
    key,
    emoji: resolution.emoji,
    label: resolution.label,
  };
}

export function logWeatherConditionDiagnostics(input: {
  provider: string;
  providerConditionId: number | null;
  providerMain: string | null;
  providerDescription: string | null;
  cloudPercentage: number | null;
  rawInternalCode: number | null;
  canonicalCondition: KindredCanonicalCondition | null;
  emoji: string | null;
  isDaytime: boolean;
  mappingSource: string | null;
  conditionSourceEndpoint?: string | null;
  normalizationVersion?: string | null;
}): void {
  console.log("[weather:condition]", input);
}
