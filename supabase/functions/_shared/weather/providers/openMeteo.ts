import type { NormalizedWeatherForecast, WeatherProvider } from "./types.ts";
import { fetchWithTimeout } from "../../http/fetchWithTimeout.ts";

type OpenMeteoResponse = {
  current?: {
    time?: string;
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
    weather_code?: number;
  };
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    weather_code?: number[];
    sunrise?: string[];
    sunset?: string[];
    uv_index_max?: number[];
    precipitation_probability_max?: number[];
    wind_speed_10m_max?: number[];
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    apparent_temperature?: number[];
    relative_humidity_2m?: number[];
    wind_speed_10m?: number[];
    weather_code?: number[];
    precipitation_probability?: number[];
  };
};

function parseIsoToUnix(iso: string | undefined): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

function toLegacy(data: OpenMeteoResponse): NormalizedWeatherForecast["legacy"] {
  return {
    current: {
      temperature_2m: data.current?.temperature_2m ?? 0,
      weather_code: data.current?.weather_code ?? 0,
    },
    daily: {
      temperature_2m_max: data.daily?.temperature_2m_max ?? [],
      temperature_2m_min: data.daily?.temperature_2m_min ?? [],
      weather_code: data.daily?.weather_code ?? [],
    },
  };
}

export async function fetchOpenMeteoForecast(
  lat: number,
  lon: number
): Promise<NormalizedWeatherForecast | null> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current:
      "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code",
    hourly:
      "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,precipitation_probability",
    daily:
      "temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,uv_index_max,precipitation_probability_max,wind_speed_10m_max",
    forecast_days: "7",
    timezone: "auto",
  });

  let res: Response;
  try {
    res = await fetchWithTimeout(`https://api.open-meteo.com/v1/forecast?${params}`, {}, 20_000);
  } catch (err) {
    console.warn("[weather:open_meteo] network error", err);
    return null;
  }

  if (!res.ok) {
    console.warn("[weather:open_meteo] fetch failed", { status: res.status });
    return null;
  }

  const data = (await res.json()) as OpenMeteoResponse;
  const currentTemp = data.current?.temperature_2m;
  const currentCode = data.current?.weather_code;
  if (currentTemp == null || currentCode == null) return null;

  const dailyDates = data.daily?.time ?? [];
  const daily = dailyDates.map((date, i) => ({
    date,
    tempMaxC: data.daily?.temperature_2m_max?.[i] ?? currentTemp,
    tempMinC: data.daily?.temperature_2m_min?.[i] ?? currentTemp,
    weatherCode: data.daily?.weather_code?.[i] ?? currentCode,
    uvi: data.daily?.uv_index_max?.[i] ?? null,
    sunrise: parseIsoToUnix(data.daily?.sunrise?.[i]),
    sunset: parseIsoToUnix(data.daily?.sunset?.[i]),
    popMax: (data.daily?.precipitation_probability_max?.[i] ?? 0) / 100,
    windSpeedMaxMs: data.daily?.wind_speed_10m_max?.[i] ?? null,
  }));

  const hourlyTimes = data.hourly?.time ?? [];
  const hourly = hourlyTimes.slice(0, 48).map((_, i) => ({
    dt: parseIsoToUnix(hourlyTimes[i]),
    tempC: data.hourly?.temperature_2m?.[i] ?? currentTemp,
    feelsLikeC: data.hourly?.apparent_temperature?.[i] ?? data.hourly?.temperature_2m?.[i] ?? currentTemp,
    weatherCode: data.hourly?.weather_code?.[i] ?? currentCode,
    pop: (data.hourly?.precipitation_probability?.[i] ?? 0) / 100,
    humidityPct: data.hourly?.relative_humidity_2m?.[i] ?? null,
    windSpeedMs: data.hourly?.wind_speed_10m?.[i] != null
      ? (data.hourly!.wind_speed_10m![i]! / 3.6)
      : null,
  }));

  const today = daily[0];

  return {
    provider: "open_meteo",
    lat,
    lon,
    retrievedAt: new Date().toISOString(),
    current: {
      temperatureC: currentTemp,
      feelsLikeC: data.current?.apparent_temperature ?? currentTemp,
      weatherCode: currentCode,
      conditionLabel: "Open-Meteo",
      uvi: today?.uvi ?? null,
      sunrise: today?.sunrise ?? 0,
      sunset: today?.sunset ?? 0,
      humidityPct: data.current?.relative_humidity_2m ?? null,
      windSpeedMs: data.current?.wind_speed_10m != null
        ? data.current.wind_speed_10m / 3.6
        : null,
      windGustMs: null,
      precipitationProbability: hourly[0]?.pop ?? today?.popMax ?? null,
    },
    daily,
    hourly,
    alerts: [],
    airQuality: null,
    legacy: toLegacy(data),
  };
}

export const openMeteoWeatherProvider: WeatherProvider = {
  id: "open_meteo",
  enabled: true,
  fetchForecast: fetchOpenMeteoForecast,
};
