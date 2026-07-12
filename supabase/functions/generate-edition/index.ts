// Kindred — generate-edition
// On-demand build for the signed-in user (manual fallback while overnight
// generation is the primary path). Secrets stay server-side only.
// Prefer client GPS location from the request body over IP geolocation.

import {
  buildEditionForUser,
  createServiceClient,
  getApproxLocation,
  resolveEditionLocation,
} from "../_shared/buildEdition.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type ClientLocation = {
  city?: string;
  region?: string | null;
  state?: string | null;
  lat?: number;
  lon?: number;
};

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
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
      });
    }

    let clientLocation: ClientLocation | null = null;
    try {
      const body = await req.json();
      if (body?.location && typeof body.location === "object") {
        clientLocation = body.location as ClientLocation;
      }
    } catch {
      // No JSON body — fall through to profile / IP.
    }

    const supabaseAdmin = createServiceClient();
    const ipApprox = await getApproxLocation(req);

    const locationHint =
      clientLocation &&
      typeof clientLocation.lat === "number" &&
      typeof clientLocation.lon === "number" &&
      clientLocation.city
        ? {
            lat: clientLocation.lat,
            lon: clientLocation.lon,
            city: clientLocation.city,
            region: clientLocation.region ?? null,
            state: clientLocation.state ?? null,
          }
        : ipApprox;

    const location = await resolveEditionLocation(
      supabaseAdmin,
      user.id,
      locationHint
    );

    console.log("[generate-edition] location", {
      source: clientLocation?.city ? "client-gps" : "profile-or-ip",
      city: location.city,
      lat: location.lat,
      lon: location.lon,
    });

    const result = await buildEditionForUser(supabaseAdmin, user.id, location);

    if (!result.ok) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 500,
      });
    }

    const editionDate = new Date().toISOString().slice(0, 10);
    await supabaseAdmin.from("generation_jobs").upsert(
      {
        user_id: user.id,
        edition_date: editionDate,
        status: "ready",
        attempts: 1,
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,edition_date" }
    );

    return new Response(
      JSON.stringify({
        success: true,
        editionId: result.editionId,
        location: {
          city: location.city,
          region: location.region,
          state: location.state,
        },
      }),
      { headers: { "content-type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
    });
  }
});
