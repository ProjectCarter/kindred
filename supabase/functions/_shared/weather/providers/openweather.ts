import type {
  NormalizedWeatherForecast,
  WeatherAirQuality,
  WeatherProvider,
} from "./types.ts";
import { openWeatherIdToWmo, primaryOpenWeatherId } from "./wmo.ts";

const ONE_CALL_V3_URL = "https://api.openweathermap.org/data/3.0/onecall";
const ONE_CALL_V25_URL = "https://api.openweathermap.org/data/2.5/onecall";
const CURRENT_WEATHER_URL = "https://api.openweathermap.org/data/2.5/weather";
const FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast";
const AIR_POLLUTION_URL = "https://api.openweathermap.org/data/2.5/air_pollution";
const USER_AGENT = "Kindred/1.0 (https://kindred.app; weather-provider)";

function apiKey(): string | null {
  try {
    return Deno.env.get("OPENWEATHER_API_KEY")?.trim() || null;
  } catch {
    return null;
  }
}

type OwWeather = { id?: number; main?: string; description?: string };
type OwOneCall = {
  lat?: number;
  lon?: number;
  timezone_offset?: number;
  current?: {
    dt?: number;
    temp?: number;
    feels_like?: number;
    uvi?: number;
    sunrise?: number;
    sunset?: number;
    humidity?: number;
    wind_speed?: number;
    wind_gust?: number;
    pop?: number;
    weather?: OwWeather[];
  };
  hourly?: Array<{
    dt?: number;
    temp?: number;
    feels_like?: number;
    pop?: number;
    humidity?: number;
    wind_speed?: number;
    weather?: OwWeather[];
  }>;
  daily?: Array<{
    dt?: number;
    temp?: { max?: number; min?: number };
    uvi?: number;
    pop?: number;
    wind_speed?: number;
    sunrise?: number;
    sunset?: number;
    weather?: OwWeather[];
  }>;
  alerts?: Array<{
    sender_name?: string;
    event?: string;
    start?: number;
    end?: number;
    description?: string;
  }>;
};

type OwAirPollution = {
  list?: Array<{
    main?: { aqi?: number };
    components?: { pm2_5?: number; pm10?: number };
  }>;
};

type OwCurrentWeather = {
  coord?: { lat?: number; lon?: number };
  main?: {
    temp?: number;
    feels_like?: number;
    humidity?: number;
    temp_min?: number;
    temp_max?: number;
  };
  wind?: { speed?: number; gust?: number };
  weather?: OwWeather[];
  sys?: { sunrise?: number; sunset?: number };
};

type OwForecastItem = {
  dt?: number;
  main?: {
    temp?: number;
    temp_min?: number;
    temp_max?: number;
    feels_like?: number;
    humidity?: number;
  };
  wind?: { speed?: number; gust?: number };
  weather?: OwWeather[];
  pop?: number;
};

type OwForecastResponse = {
  list?: OwForecastItem[];
  city?: { sunrise?: number; sunset?: number; timezone?: number };
};

function formatDateFromUnix(unix: number, offsetSec = 0): string {
  const d = new Date((unix + offsetSec) * 1000);
  return d.toISOString().slice(0, 10);
}

async function fetchAirQuality(
  lat: number,
  lon: number,
  key: string
): Promise<WeatherAirQuality | null> {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lon), appid: key });
  try {
    const res = await fetch(`${AIR_POLLUTION_URL}?${params}`, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as OwAirPollution;
    const point = data.list?.[0];
    if (!point?.main?.aqi) return null;
    return {
      aqi: point.main.aqi,
      pm25: point.components?.pm2_5 ?? null,
      pm10: point.components?.pm10 ?? null,
    };
  } catch {
    return null;
  }
}

function normalizeOneCall(
  data: OwOneCall,
  lat: number,
  lon: number,
  airQuality: WeatherAirQuality | null
): NormalizedWeatherForecast | null {
  const current = data.current;
  if (current?.temp == null) return null;

  const owId = primaryOpenWeatherId(current.weather);
  const weatherCode = openWeatherIdToWmo(owId);
  const offset = data.timezone_offset ?? 0;

  const daily = (data.daily ?? []).slice(0, 7).map((day) => {
    const code = openWeatherIdToWmo(primaryOpenWeatherId(day.weather));
    const dt = day.dt ?? 0;
    return {
      date: formatDateFromUnix(dt, offset),
      tempMaxC: day.temp?.max ?? current.temp!,
      tempMinC: day.temp?.min ?? current.temp!,
      weatherCode: code,
      uvi: day.uvi ?? null,
      sunrise: day.sunrise ?? 0,
      sunset: day.sunset ?? 0,
      popMax: day.pop ?? null,
      windSpeedMaxMs: day.wind_speed ?? null,
    };
  });

  const hourly = (data.hourly ?? []).slice(0, 48).map((hour) => ({
    dt: hour.dt ?? 0,
    tempC: hour.temp ?? current.temp!,
    feelsLikeC: hour.feels_like ?? hour.temp ?? current.temp!,
    weatherCode: openWeatherIdToWmo(primaryOpenWeatherId(hour.weather)),
    pop: hour.pop ?? 0,
    humidityPct: hour.humidity ?? null,
    windSpeedMs: hour.wind_speed ?? null,
  }));

  const alerts = (data.alerts ?? []).map((a) => ({
    event: a.event ?? "Weather alert",
    start: a.start ?? 0,
    end: a.end ?? 0,
    description: (a.description ?? "").slice(0, 500),
    sender: a.sender_name ?? "National Weather Service",
  }));

  const legacyDailyMax = daily.map((d) => d.tempMaxC);
  const legacyDailyMin = daily.map((d) => d.tempMinC);
  const legacyDailyCode = daily.map((d) => d.weatherCode);

  return {
    provider: "openweather",
    lat: data.lat ?? lat,
    lon: data.lon ?? lon,
    retrievedAt: new Date().toISOString(),
    current: {
      temperatureC: current.temp,
      feelsLikeC: current.feels_like ?? current.temp,
      weatherCode,
      conditionLabel: current.weather?.[0]?.main ?? "OpenWeather",
      uvi: current.uvi ?? null,
      sunrise: current.sunrise ?? daily[0]?.sunrise ?? 0,
      sunset: current.sunset ?? daily[0]?.sunset ?? 0,
      humidityPct: current.humidity ?? null,
      windSpeedMs: current.wind_speed ?? null,
      windGustMs: current.wind_gust ?? null,
      precipitationProbability: current.pop ?? hourly[0]?.pop ?? null,
    },
    daily,
    hourly,
    alerts,
    airQuality,
    legacy: {
      current: {
        temperature_2m: current.temp,
        weather_code: weatherCode,
      },
      daily: {
        temperature_2m_max: legacyDailyMax,
        temperature_2m_min: legacyDailyMin,
        weather_code: legacyDailyCode,
      },
    },
  };
}

async function fetchOneCall(
  url: string,
  lat: number,
  lon: number,
  key: string
): Promise<OwOneCall | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    appid: key,
    units: "metric",
    exclude: "minutely",
  });

  try {
    const res = await fetch(`${url}?${params}`, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (res.status === 429) {
      console.warn("[weather:openweather] rate limited", { url });
      return null;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn("[weather:openweather] onecall failed", {
        url,
        status: res.status,
        body: body.slice(0, 200),
      });
      return null;
    }
    return (await res.json()) as OwOneCall;
  } catch (err) {
    console.warn("[weather:openweather] onecall network error", err);
    return null;
  }
}

function aggregateDailyFromForecast(
  list: OwForecastItem[],
  timezoneOffsetSec = 0
): NormalizedWeatherForecast["daily"] {
  const byDate = new Map<
    string,
    { max: number; min: number; code: number; pop: number }
  >();

  for (const item of list) {
    if (item.dt == null || item.main?.temp == null) continue;
    const date = formatDateFromUnix(item.dt, timezoneOffsetSec);
    const code = openWeatherIdToWmo(primaryOpenWeatherId(item.weather));
    const max = item.main.temp_max ?? item.main.temp;
    const min = item.main.temp_min ?? item.main.temp;
    const existing = byDate.get(date);
    if (!existing) {
      byDate.set(date, { max, min, code, pop: item.pop ?? 0 });
    } else {
      existing.max = Math.max(existing.max, max);
      existing.min = Math.min(existing.min, min);
      existing.pop = Math.max(existing.pop, item.pop ?? 0);
    }
  }

  return [...byDate.entries()].slice(0, 7).map(([date, row]) => ({
    date,
    tempMaxC: row.max,
    tempMinC: row.min,
    weatherCode: row.code,
    uvi: null,
    sunrise: 0,
    sunset: 0,
    popMax: row.pop,
    windSpeedMaxMs: null,
  }));
}

async function fetchCompositeForecast(
  lat: number,
  lon: number,
  key: string,
  airQuality: WeatherAirQuality | null
): Promise<NormalizedWeatherForecast | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    appid: key,
    units: "metric",
  });

  let currentRes: Response;
  let forecastRes: Response;
  try {
    [currentRes, forecastRes] = await Promise.all([
      fetch(`${CURRENT_WEATHER_URL}?${params}`, {
        headers: { "User-Agent": USER_AGENT },
      }),
      fetch(`${FORECAST_URL}?${params}`, {
        headers: { "User-Agent": USER_AGENT },
      }),
    ]);
  } catch (err) {
    console.warn("[weather:openweather] composite network error", err);
    return null;
  }

  if (!currentRes.ok || !forecastRes.ok) {
    console.warn("[weather:openweather] composite fetch failed", {
      currentStatus: currentRes.status,
      forecastStatus: forecastRes.status,
    });
    return null;
  }

  const currentData = (await currentRes.json()) as OwCurrentWeather;
  const forecastData = (await forecastRes.json()) as OwForecastResponse;
  const temp = currentData.main?.temp;
  if (temp == null) return null;

  const owId = primaryOpenWeatherId(currentData.weather);
  const weatherCode = openWeatherIdToWmo(owId);
  const timezoneOffset = forecastData.city?.timezone ?? 0;
  const daily = aggregateDailyFromForecast(forecastData.list ?? [], timezoneOffset);
  const hourly = (forecastData.list ?? []).slice(0, 16).map((item) => ({
    dt: item.dt ?? 0,
    tempC: item.main?.temp ?? temp,
    feelsLikeC: item.main?.feels_like ?? item.main?.temp ?? temp,
    weatherCode: openWeatherIdToWmo(primaryOpenWeatherId(item.weather)),
    pop: item.pop ?? 0,
    humidityPct: item.main?.humidity ?? null,
    windSpeedMs: item.wind?.speed ?? null,
  }));

  if (daily.length === 0) {
    daily.push({
      date: formatDateFromUnix(Math.floor(Date.now() / 1000), timezoneOffset),
      tempMaxC: temp,
      tempMinC: temp,
      weatherCode: weatherCode,
      uvi: null,
      sunrise: currentData.sys?.sunrise ?? forecastData.city?.sunrise ?? 0,
      sunset: currentData.sys?.sunset ?? forecastData.city?.sunset ?? 0,
      popMax: hourly[0]?.pop ?? null,
      windSpeedMaxMs: currentData.wind?.speed ?? null,
    });
  } else {
    daily[0]!.sunrise = currentData.sys?.sunrise ?? forecastData.city?.sunrise ?? 0;
    daily[0]!.sunset = currentData.sys?.sunset ?? forecastData.city?.sunset ?? 0;
  }

  return {
    provider: "openweather",
    lat: currentData.coord?.lat ?? lat,
    lon: currentData.coord?.lon ?? lon,
    retrievedAt: new Date().toISOString(),
    current: {
      temperatureC: temp,
      feelsLikeC: currentData.main?.feels_like ?? temp,
      weatherCode,
      conditionLabel: currentData.weather?.[0]?.main ?? "OpenWeather",
      uvi: null,
      sunrise: currentData.sys?.sunrise ?? daily[0]?.sunrise ?? 0,
      sunset: currentData.sys?.sunset ?? daily[0]?.sunset ?? 0,
      humidityPct: currentData.main?.humidity ?? null,
      windSpeedMs: currentData.wind?.speed ?? null,
      windGustMs: currentData.wind?.gust ?? null,
      precipitationProbability: hourly[0]?.pop ?? null,
    },
    daily,
    hourly,
    alerts: [],
    airQuality,
    legacy: {
      current: { temperature_2m: temp, weather_code: weatherCode },
      daily: {
        temperature_2m_max: daily.map((d) => d.tempMaxC),
        temperature_2m_min: daily.map((d) => d.tempMinC),
        weather_code: daily.map((d) => d.weatherCode),
      },
    },
  };
}

export async function fetchOpenWeatherForecast(
  lat: number,
  lon: number
): Promise<NormalizedWeatherForecast | null> {
  const key = apiKey();
  if (!key) {
    console.log("[weather:openweather] skipped — OPENWEATHER_API_KEY not set");
    return null;
  }

  const airQuality = await fetchAirQuality(lat, lon, key);

  const oneCall =
    (await fetchOneCall(ONE_CALL_V3_URL, lat, lon, key)) ??
    (await fetchOneCall(ONE_CALL_V25_URL, lat, lon, key));

  if (oneCall) {
    const normalized = normalizeOneCall(oneCall, lat, lon, airQuality);
    if (normalized) return normalized;
  }

  console.log("[weather:openweather] falling back to current + forecast APIs");
  return fetchCompositeForecast(lat, lon, key, airQuality);
}

export function isOpenWeatherEnabled(): boolean {
  return Boolean(apiKey());
}

export const openWeatherProvider: WeatherProvider = {
  id: "openweather",
  enabled: isOpenWeatherEnabled(),
  fetchForecast: fetchOpenWeatherForecast,
};
