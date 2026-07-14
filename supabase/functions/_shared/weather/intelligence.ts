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

  const hourlyRainSoon = forecast.hourly
    .slice(0, 6)
    .some((h: { pop: number; weatherCode: number }) =>
      h.pop >= 0.55 || isRainCode(h.weatherCode)
    );
  const isRainy =
    isRainCode(code) ||
    hourlyRainSoon ||
    weatherBucket(weatherSummary) === "rainy";
  const isStormy = isStormCode(code) || forecast.alerts.length > 0;
  const isHot = mood === "hot" || highC >= 33;
  const isCold = mood === "cold" || isSnowCode(code);

  const isClearish = [0, 1, 2].includes(code);
  const isIdealBeachWeather =
    isClearish && highC >= 24 && highC <= 34 && !isRainy && !isStormy;

  const uviHigh = Math.max(
    forecast.current.uvi ?? 0,
    today?.uvi ?? 0
  );
  const airQualityPoor = (forecast.airQuality?.aqi ?? 0) >= 4;

  const isIndoorPreferred =
    isRainy || isStormy || isHot || airQualityPoor || uviHigh >= 8;

  const sunriseHour = hourFromUnix(forecast.current.sunrise);
  const morningCool = highC <= 28 && !isRainy && !isStormy;
  const isIdealSunriseHike =
    morningCool && isClearish && sunriseHour != null;

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
          .map((a: { event: string }) => a.event)
          .join("; ")
      : null;

  return {
    bucket,
    isRainy,
    isStormy,
    isHot,
    isCold,
    isIdealBeachWeather,
    isIndoorPreferred,
    isIdealSunriseHike,
    hasActiveAlerts: forecast.alerts.length > 0,
    alertSummary,
    uviHigh: uviHigh > 0 ? uviHigh : null,
    airQualityPoor,
    provider: forecast.provider,
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
