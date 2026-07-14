import type { NormalizedWeatherForecast, WeatherIntelligence } from "./providers/types.ts";
import { weatherBucket } from "../discovery/taxonomy.ts";
import { moodFromTempC } from "../editorialTemplates.ts";

function isRainCode(code: number): boolean {
  return [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code);
}

function isStormCode(code: number): boolean {
  return [95, 96, 99].includes(code);
}

function isSnowCode(code: number): boolean {
  return [71, 73, 75, 77, 85, 86].includes(code);
}

function hourFromUnix(unix: number): number | null {
  if (!unix) return null;
  return new Date(unix * 1000).getHours();
}

function buildPlanningNote(input: {
  isRainy: boolean;
  rainBeginsAfternoon: boolean;
  isIdealBeachWeather: boolean;
  isIndoorPreferred: boolean;
  isIdealSunriseHike: boolean;
  isWindy: boolean;
  uviHigh: number | null;
  alertSummary: string | null;
  severeWeather: boolean;
}): string | null {
  if (input.severeWeather && input.alertSummary) {
    return `Weather advisory in effect: ${input.alertSummary}.`;
  }
  if (input.rainBeginsAfternoon && !input.isRainy) {
    return "Rain may arrive this afternoon — morning outdoor plans are the stronger bet.";
  }
  if (input.isRainy) {
    return "Rain in the forecast — museums, coffee shops, and indoor activities suit the day better.";
  }
  if (input.isIdealBeachWeather) {
    return "Clear and warm — beaches, parks, and patios are especially worth the trip today.";
  }
  if (input.isIdealSunriseHike) {
    return "Clear morning conditions — sunrise hikes and early trails beat the afternoon heat.";
  }
  if (input.uviHigh != null && input.uviHigh >= 8) {
    return "High UV today — shaded parks and morning or evening outings are smarter than midday sun.";
  }
  if (input.isWindy) {
    return "Windy conditions — sheltered parks and indoor picks may feel more comfortable.";
  }
  if (input.isIndoorPreferred) {
    return "Heat or air quality makes indoor recommendations the kinder choice today.";
  }
  return null;
}

/**
 * Structured weather signals for discovery scoring and editorial context.
 * Derived from normalized provider output — never invented.
 */
export function buildWeatherIntelligence(
  forecast: NormalizedWeatherForecast | null,
  weatherSummary?: string | null
): WeatherIntelligence | null {
  if (!forecast) return null;

  const today = forecast.daily[0];
  const highC = today?.tempMaxC ?? forecast.current.temperatureC;
  const code = forecast.current.weatherCode;
  const mood = moodFromTempC(highC);
  const windSpeedMs = forecast.current.windSpeedMs;

  const hourlyRainSoon = forecast.hourly
    .slice(0, 6)
    .some((h) => h.pop >= 0.55 || isRainCode(h.weatherCode));
  const afternoonRain = forecast.hourly
    .slice(6, 14)
    .some((h) => h.pop >= 0.5 || isRainCode(h.weatherCode));
  const morningClear = forecast.hourly
    .slice(0, 4)
    .every((h) => !isRainCode(h.weatherCode) && h.pop < 0.45);

  const isRainy =
    isRainCode(code) ||
    hourlyRainSoon ||
    weatherBucket(weatherSummary) === "rainy";
  const isStormy = isStormCode(code) || forecast.alerts.length > 0;
  const isHot = mood === "hot" || highC >= 33;
  const isCold = mood === "cold" || isSnowCode(code);
  const isWindy = (windSpeedMs ?? 0) >= 11;

  const isClearish = [0, 1, 2].includes(code);
  const isIdealBeachWeather =
    isClearish && highC >= 24 && highC <= 34 && !isRainy && !isStormy && !isWindy;

  const uviHigh = Math.max(forecast.current.uvi ?? 0, today?.uvi ?? 0);
  const airQualityPoor = (forecast.airQuality?.aqi ?? 0) >= 4;

  const isIndoorPreferred =
    isRainy || isStormy || isHot || airQualityPoor || uviHigh >= 8;

  const sunriseHour = hourFromUnix(forecast.current.sunrise);
  const morningCool = highC <= 28 && !isRainy && !isStormy;
  const isIdealSunriseHike =
    morningCool && isClearish && sunriseHour != null && morningClear;
  const isIdealMorningOutdoor =
    morningClear && !isStormy && highC <= 32;
  const isIdealShadedPark =
    isClearish && uviHigh >= 7 && !isRainy && !isStormy;
  const isIdealPatios =
    isClearish && highC >= 18 && highC <= 30 && !isRainy && !isWindy;
  const rainBeginsAfternoon = !isRainy && afternoonRain && morningClear;
  const severeWeather =
    isStormy ||
    forecast.alerts.some((a) =>
      /severe|extreme|warning|watch|emergency/i.test(a.event)
    );

  let bucket = weatherBucket(weatherSummary);
  if (bucket === "any") {
    if (isRainy || isStormy) bucket = "rainy";
    else if (isCold) bucket = "cool";
    else if (isClearish && highC >= 18) bucket = "fair";
  }

  const alertSummary =
    forecast.alerts.length > 0
      ? forecast.alerts
          .slice(0, 2)
          .map((a) => a.event)
          .join("; ")
      : null;

  const planningNote = buildPlanningNote({
    isRainy,
    rainBeginsAfternoon,
    isIdealBeachWeather,
    isIndoorPreferred,
    isIdealSunriseHike,
    isWindy,
    uviHigh: uviHigh > 0 ? uviHigh : null,
    alertSummary,
    severeWeather,
  });

  return {
    bucket,
    isRainy,
    isStormy,
    isHot,
    isCold,
    isWindy,
    isIdealBeachWeather,
    isIndoorPreferred,
    isIdealSunriseHike,
    isIdealMorningOutdoor,
    isIdealShadedPark,
    isIdealPatios,
    rainBeginsAfternoon,
    hasActiveAlerts: forecast.alerts.length > 0,
    severeWeather,
    alertSummary,
    uviHigh: uviHigh > 0 ? uviHigh : null,
    airQualityPoor,
    windSpeedMs: windSpeedMs ?? null,
    provider: forecast.provider,
    planningNote,
  };
}

export function weatherSourceAttribution(
  forecast: NormalizedWeatherForecast | null
): string {
  if (!forecast) return "Weather unavailable";
  return forecast.provider === "openweather"
    ? "Sourced from OpenWeather"
    : "Sourced from Open-Meteo";
}
