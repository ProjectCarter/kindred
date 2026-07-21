// Kindred — refresh-weather
// Live current conditions for the homepage — independent from edition build.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  createServiceClient,
  resolveEditionLocation,
} from "../_shared/editionRuntime.ts";
import { fetchWeatherForecast } from "../_shared/weather/providers/index.ts";
import {
  formatWeatherSummary,
  resolveTemperatureUnit,
} from "../_shared/weather/units.ts";

type ClientLocation = {
  city?: string;
  region?: string | null;
  state?: string | null;
  lat?: number;
  lon?: number;
};

Deno.serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return Response.json(
        { error: "Server configuration incomplete." },
        { status: 500 }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return Response.json({ error: "Missing auth" }, { status: 401 });
    }

    const supabaseUser = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    let clientLocation: ClientLocation | null = null;
    try {
      const body = await req.json();
      if (body?.location && typeof body.location === "object") {
        clientLocation = body.location as ClientLocation;
      }
    } catch {
      /* optional body */
    }

    const admin = createServiceClient();
    const hint =
      clientLocation &&
      typeof clientLocation.lat === "number" &&
      typeof clientLocation.lon === "number" &&
      typeof clientLocation.city === "string" &&
      clientLocation.city.trim()
        ? {
            lat: clientLocation.lat,
            lon: clientLocation.lon,
            city: clientLocation.city.trim(),
            region: clientLocation.region ?? null,
            state: clientLocation.state ?? null,
          }
        : null;

    const location = await resolveEditionLocation(admin, user.id, hint);
    if (!location) {
      return Response.json({ error: "location_required" }, { status: 400 });
    }

    const fetchStarted = Date.now();
    const forecast = await fetchWeatherForecast(
      location.lat,
      location.lon,
      admin,
      { skipCache: true }
    );
    if (!forecast) {
      return Response.json({ error: "weather_unavailable" }, { status: 502 });
    }

    const unit = resolveTemperatureUnit("auto", {
      state: location.state,
      region: location.region,
    });
    const today = forecast.daily[0];
    const weatherSummary = formatWeatherSummary({
      city: location.city,
      currentC: forecast.current.temperatureC,
      highC: today?.tempMaxC ?? null,
      lowC: today?.tempMinC ?? null,
      unit,
      conditionCode: forecast.current.weatherCode,
    });

    if (!weatherSummary) {
      return Response.json({ error: "weather_format_failed" }, { status: 502 });
    }

    const fetchTimestamp = new Date().toISOString();
    const cacheAgeMs = Math.max(0, fetchStarted - Date.parse(forecast.retrievedAt));

    console.log("[refresh-weather]", {
      provider: forecast.provider,
      retrievedAt: forecast.retrievedAt,
      fetchTimestamp,
      lat: location.lat.toFixed(4),
      lon: location.lon.toFixed(4),
      cacheAgeMs,
      currentC: forecast.current.temperatureC,
      highC: today?.tempMaxC ?? null,
      lowC: today?.tempMinC ?? null,
      conditionCode: forecast.current.weatherCode,
    });

    return Response.json({
      ok: true,
      weatherSummary,
      retrievedAt: forecast.retrievedAt,
      fetchTimestamp,
      provider: forecast.provider,
      lat: location.lat,
      lon: location.lon,
      conditionCode: forecast.current.weatherCode,
      currentC: forecast.current.temperatureC,
      highC: today?.tempMaxC ?? null,
      lowC: today?.tempMinC ?? null,
      cacheAgeMs,
    });
  } catch (err) {
    console.error("[refresh-weather] failure", err);
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
});
