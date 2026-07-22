// Kindred — live-weather
//
// Lightweight homepage weather hydration. One shared cached response per metro
// coordinates (~12 min TTL). No edition rebuild, no AI, no full pipeline.

import { createServiceClient } from "../_shared/editionRuntime.ts";
import { resolveLiveWeather } from "../_shared/weather/liveWeather.ts";
import type { TemperatureUnit } from "../_shared/weather/units.ts";

type LiveWeatherRequest = {
  lat?: number;
  lon?: number;
  city?: string;
  metroKey?: string;
  unit?: TemperatureUnit;
};

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json({ error: "Missing auth" }, { status: 401 });
    }

    let body: LiveWeatherRequest = {};
    try {
      body = (await req.json()) as LiveWeatherRequest;
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const lat = Number(body.lat);
    const lon = Number(body.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return Response.json({ error: "lat and lon are required" }, { status: 400 });
    }

    const unit: TemperatureUnit =
      body.unit === "celsius" ? "celsius" : "fahrenheit";

    const admin = createServiceClient();
    const result = await resolveLiveWeather({
      admin,
      lat,
      lon,
      city: typeof body.city === "string" ? body.city : null,
      metroKey: typeof body.metroKey === "string" ? body.metroKey : null,
      unit,
    });

    if (!result) {
      return Response.json(
        { error: "Weather unavailable", weather: null },
        { status: 503 }
      );
    }

    return Response.json({
      weather: result.weather,
      source: result.source,
    });
  } catch (err) {
    console.error("[live-weather] unhandled", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
});
