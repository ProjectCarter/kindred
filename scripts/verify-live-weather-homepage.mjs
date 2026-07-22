/**
 * End-to-end verification: deployed live-weather + homepage display resolution.
 * Usage: node scripts/verify-live-weather-homepage.mjs
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    const env = {};
    for (const line of raw.split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    return env;
  } catch {
    return {};
  }
}

const env = loadEnvLocal();
const url = `${env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/live-weather`;
const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const gilbert = {
  lat: 33.2748,
  lon: -111.7769,
  city: "Gilbert",
  metroKey: "gilbert-az",
  unit: "fahrenheit",
};

const editionSnapshot83 = {
  retrievedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  conditionCode: 3,
  currentTempC: 28.3,
  highTempC: 31.1,
  lowTempC: 22.2,
  windSpeedMs: 3,
  unit: "fahrenheit",
  alerts: [],
  guidanceNote: null,
};

async function invokeLiveWeather() {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(gilbert),
  });
  const body = await res.json();
  return { status: res.status, body };
}

async function main() {
  const { resolveHomepageWeatherDisplay } = await import(
    "../lib/weather/homepageWeatherDisplay.ts"
  );
  const { parseLiveWeatherResponse } = await import(
    "../lib/weather/liveWeatherTypes.ts"
  );

  console.log("=== Direct Edge Function (Gilbert) ===");
  const live = await invokeLiveWeather();
  console.log("HTTP status:", live.status);
  console.log("source:", live.body?.source);
  const weather = live.body?.weather;
  if (weather) {
    const tempF = Math.round((weather.currentTempC * 9) / 5 + 32);
    console.log("provider:", weather.provider);
    console.log("coordinates:", weather.latitude, weather.longitude);
    console.log("currentTempF:", tempF);
    console.log("conditionCode:", weather.conditionCode);
    console.log("highTempC:", weather.highTempC);
    console.log("lowTempC:", weather.lowTempC);
    console.log("observedAt:", weather.observedAt);
    console.log("fetchedAt:", weather.fetchedAt);
    console.log("expiresAt:", weather.expiresAt);
    console.log("guidanceNote:", weather.guidanceNote);
  } else {
    console.log("body:", live.body);
  }

  console.log("\n=== Homepage resolution scenarios ===");

  const parsedLive = parseLiveWeatherResponse(weather);
  const withLive = resolveHomepageWeatherDisplay({
    weatherSnapshot: editionSnapshot83,
    liveWeather: parsedLive,
    liveWeatherSource: live.body?.source === "server-cache" ? "server-cache" : "live",
  });
  console.log("Live replaces stale edition:", withLive.current, withLive.condition.label, withLive.dataSource);

  const editionOnly = resolveHomepageWeatherDisplay({
    weatherSnapshot: editionSnapshot83,
    liveWeather: null,
  });
  console.log("Stale edition fallback:", editionOnly.current, editionOnly.condition.label, editionOnly.fallbackReason);

  const none = resolveHomepageWeatherDisplay({});
  console.log("No data:", none.isUnavailable ? none.condition.label : none.current);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
