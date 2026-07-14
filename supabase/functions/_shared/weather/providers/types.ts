/**
 * Weather Provider contracts — normalized forecast for Kindred editorial.
 * OpenWeather is primary when OPENWEATHER_API_KEY is set; Open-Meteo fallback.
 */

export type WeatherProviderId = "openweather" | "open_meteo";

export type WeatherAlert = {
  event: string;
  start: number;
  end: number;
  description: string;
  sender: string;
};

export type WeatherAirQuality = {
  aqi: number;
  pm25: number | null;
  pm10: number | null;
};

export type WeatherHourlyPoint = {
  dt: number;
  tempC: number;
  feelsLikeC: number | null;
  weatherCode: number;
  pop: number;
  humidityPct: number | null;
  windSpeedMs: number | null;
};

export type WeatherDailyPoint = {
  date: string;
  tempMaxC: number;
  tempMinC: number;
  weatherCode: number;
  uvi: number | null;
  sunrise: number;
  sunset: number;
  popMax: number | null;
  windSpeedMaxMs: number | null;
};

export type WeatherCurrentConditions = {
  temperatureC: number;
  feelsLikeC: number;
  weatherCode: number;
  conditionLabel: string;
  uvi: number | null;
  sunrise: number;
  sunset: number;
  humidityPct: number | null;
  windSpeedMs: number | null;
  windGustMs: number | null;
  precipitationProbability: number | null;
};

export type NormalizedWeatherForecast = {
  provider: WeatherProviderId;
  lat: number;
  lon: number;
  retrievedAt: string;
  current: WeatherCurrentConditions;
  daily: WeatherDailyPoint[];
  hourly: WeatherHourlyPoint[];
  alerts: WeatherAlert[];
  airQuality: WeatherAirQuality | null;
  /** Adapter shape for existing buildEdition / formatWeatherSummary consumers. */
  legacy: {
    current: { temperature_2m: number; weather_code: number };
    daily: {
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      weather_code: number[];
    };
  };
};

export type WeatherIntelligence = {
  bucket: "fair" | "cool" | "rainy" | "any";
  isRainy: boolean;
  isStormy: boolean;
  isHot: boolean;
  isCold: boolean;
  isWindy: boolean;
  isIdealBeachWeather: boolean;
  isIndoorPreferred: boolean;
  isIdealSunriseHike: boolean;
  isIdealMorningOutdoor: boolean;
  isIdealShadedPark: boolean;
  isIdealPatios: boolean;
  rainBeginsAfternoon: boolean;
  hasActiveAlerts: boolean;
  severeWeather: boolean;
  alertSummary: string | null;
  uviHigh: number | null;
  airQualityPoor: boolean;
  windSpeedMs: number | null;
  provider: WeatherProviderId;
  /** Editorial planning note — for Bandit / future surfaces, not raw API copy. */
  planningNote: string | null;
};

export type WeatherProvider = {
  id: WeatherProviderId;
  enabled: boolean;
  fetchForecast(lat: number, lon: number): Promise<NormalizedWeatherForecast | null>;
};

/** Full forecast bundle — current changes slowly within an hour. */
export const WEATHER_CACHE_TTL_MINUTES = 45;
