// Kindred — generate-edition
// On-demand build for the signed-in user.
// Requires an explicit client location — never silently falls back to IP or a hard-coded city.

import {
  buildEditionForUser,
  createServiceClient,
  resolveEditionLocation,
  type BuildEditionOptions,
} from "../_shared/buildEdition.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type { TemperatureUnitPreference } from "../_shared/weather/units.ts";

type ClientLocation = {
  city?: string;
  region?: string | null;
  state?: string | null;
  lat?: number;
  lon?: number;
};

function morningHeroSummary(
  hero: {
    artworkId?: string;
    artworkTitle?: string;
    artist?: string;
    hostedUrl?: string;
  } | null | undefined
) {
  if (!hero?.artworkId || !hero.hostedUrl?.trim()) {
    return { present: false as const };
  }
  return {
    present: true as const,
    artworkId: hero.artworkId,
    artworkTitle: hero.artworkTitle ?? null,
    artist: hero.artist ?? null,
    hostedUrl: hero.hostedUrl,
  };
}

Deno.serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error("[generate-edition] missing SUPABASE_URL or SERVICE_ROLE_KEY");
      return new Response(
        JSON.stringify({
          error: "Server configuration incomplete. Missing Supabase credentials.",
        }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    const supabaseUser = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    let clientLocation: ClientLocation | null = null;
    let editionDate: string | null = null;
    let temperatureUnitPreference: TemperatureUnitPreference | null = null;

    try {
      const body = await req.json();
      if (body?.location && typeof body.location === "object") {
        clientLocation = body.location as ClientLocation;
      }
      if (
        typeof body?.editionDate === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(body.editionDate)
      ) {
        editionDate = body.editionDate;
      }
      if (
        body?.temperatureUnit === "auto" ||
        body?.temperatureUnit === "fahrenheit" ||
        body?.temperatureUnit === "celsius"
      ) {
        temperatureUnitPreference = body.temperatureUnit;
      }
    } catch {
      // No JSON body
    }

    const locationUsable =
      clientLocation &&
      typeof clientLocation.lat === "number" &&
      typeof clientLocation.lon === "number" &&
      Number.isFinite(clientLocation.lat) &&
      Number.isFinite(clientLocation.lon) &&
      typeof clientLocation.city === "string" &&
      clientLocation.city.trim().length > 0 &&
      clientLocation.city.trim().toLowerCase() !== "your area";

    if (!locationUsable) {
      return new Response(
        JSON.stringify({
          error:
            "location_required — send { location: { city, lat, lon } } from the device. Kindred never invents a city.",
        }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    const locationHint = {
      lat: clientLocation!.lat!,
      lon: clientLocation!.lon!,
      city: clientLocation!.city!.trim(),
      region: clientLocation!.region ?? null,
      state: clientLocation!.state ?? null,
    };

    const supabaseAdmin = createServiceClient();

    // Persist active location so overnight jobs match the reader's city.
    await supabaseAdmin
      .from("profiles")
      .update({
        location: {
          city: locationHint.city,
          region: locationHint.region,
          state: locationHint.state,
          lat: locationHint.lat,
          lon: locationHint.lon,
        },
      })
      .eq("id", user.id);

    const location = await resolveEditionLocation(
      supabaseAdmin,
      user.id,
      locationHint
    );

    if (!location) {
      return new Response(
        JSON.stringify({
          error:
            "No location set. Choose a home city or enable current location.",
        }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    console.log("[generate-edition] location", {
      source: "client",
      mode: "explicit-body",
      city: location.city,
      region: location.region,
      state: location.state,
      lat: location.lat,
      lon: location.lon,
      editionDate,
      temperatureUnitPreference,
      temperatureResolvedHint:
        temperatureUnitPreference === "celsius"
          ? "celsius"
          : temperatureUnitPreference === "fahrenheit"
            ? "fahrenheit"
            : "auto→US→fahrenheit expected for AZ",
    });

    const buildOptions: BuildEditionOptions = {
      editionDate,
      temperatureUnitPreference: temperatureUnitPreference ?? "auto",
    };

    const result = await buildEditionForUser(
      supabaseAdmin,
      user.id,
      location,
      buildOptions
    );

    if (!result.ok) {
      console.error("[generate-edition] build failed", result.error);
      return new Response(JSON.stringify({ error: result.error }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    const jobDate =
      editionDate && /^\d{4}-\d{2}-\d{2}$/.test(editionDate)
        ? editionDate
        : new Date().toISOString().slice(0, 10);

    await supabaseAdmin.from("generation_jobs").upsert(
      {
        user_id: user.id,
        edition_date: jobDate,
        status: "ready",
        attempts: 1,
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,edition_date" }
    );

    const { data: editionRow } = await supabaseAdmin
      .from("editions")
      .select("morning_edition")
      .eq("id", result.editionId)
      .maybeSingle();
    const morningHero = (
      editionRow?.morning_edition as {
        morningHero?: {
          artworkId?: string;
          artworkTitle?: string;
          artist?: string;
          hostedUrl?: string;
        } | null;
      } | null
    )?.morningHero;

    return new Response(
      JSON.stringify({
        success: true,
        editionId: result.editionId,
        location: {
          city: location.city,
          region: location.region,
          state: location.state,
        },
        editionDate: jobDate,
        morningHero: morningHeroSummary(morningHero),
      }),
      { headers: { "content-type": "application/json" } }
    );
  } catch (err) {
    console.error("[generate-edition] failure", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
});
