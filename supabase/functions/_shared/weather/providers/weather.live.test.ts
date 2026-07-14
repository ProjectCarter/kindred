import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { fetchOpenWeatherForecast } from "./openweather.ts";
import { fetchWeatherForecast, isOpenWeatherConfigured } from "./index.ts";

Deno.test("openweather live fetch returns normalized forecast when API accepts key", async () => {
  if (!isOpenWeatherConfigured()) {
    console.warn("[weather.live] OPENWEATHER_API_KEY not set — skipping live test");
    return;
  }

  const forecast = await fetchOpenWeatherForecast(33.3528, -111.789);
  if (!forecast) {
    console.warn(
      "[weather.live] OpenWeather returned null — key may still be activating (up to 2 hours), " +
        "or One Call 3.0 subscription may be required. Open-Meteo fallback remains active."
    );
    return;
  }

  assertEquals(forecast.provider, "openweather");
  assertEquals(typeof forecast.current.temperatureC, "number");
  assertEquals(typeof forecast.current.weatherCode, "number");
  assertEquals(forecast.daily.length >= 1, true);
  assertEquals(forecast.hourly.length >= 1, true);
  assertEquals(typeof forecast.legacy.current.temperature_2m, "number");
  assertEquals(typeof forecast.legacy.daily.temperature_2m_max[0], "number");
});

Deno.test("fetchWeatherForecast always returns a forecast via provider chain", async () => {
  const forecast = await fetchWeatherForecast(33.3528, -111.789, null);
  assertEquals(forecast != null, true);
  assertEquals(
    forecast!.provider === "openweather" || forecast!.provider === "open_meteo",
    true
  );
  assertEquals(forecast!.daily.length >= 1, true);
});

Deno.test("api key is never exposed in forecast payload", async () => {
  if (!isOpenWeatherConfigured()) return;
  const forecast = await fetchOpenWeatherForecast(33.3528, -111.789);
  if (!forecast) return;
  const serialized = JSON.stringify(forecast);
  const key = Deno.env.get("OPENWEATHER_API_KEY") ?? "";
  if (key) {
    assertEquals(serialized.includes(key), false);
  }
});
