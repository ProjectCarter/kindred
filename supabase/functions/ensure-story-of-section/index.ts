// Kindred — ensure-story-of-section
// Inserts story_of from kindred_city_articles when an existing edition lacks it.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  createServiceClient,
  resolveEditionLocation,
} from "../_shared/buildEdition.ts";
import { ensureStoryOfSectionForEdition } from "../_shared/storyOf/ensureStoryOfSection.ts";

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
      return Response.json({ error: "Server configuration incomplete." }, { status: 500 });
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

    let editionDate: string | null = null;
    let clientLocation: ClientLocation | null = null;
    try {
      const body = await req.json();
      if (typeof body?.editionDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.editionDate)) {
        editionDate = body.editionDate;
      }
      if (body?.location && typeof body.location === "object") {
        clientLocation = body.location as ClientLocation;
      }
    } catch {
      // optional body
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
    const city = location?.city?.trim();
    if (!city || city.toLowerCase() === "your area") {
      return Response.json({ ok: true, changed: false, error: "no_city" });
    }

    const date =
      editionDate ??
      new Date().toLocaleDateString("en-CA", { timeZone: "America/Phoenix" });

    const { data: edition, error: editionError } = await admin
      .from("editions")
      .select("id")
      .eq("user_id", user.id)
      .eq("edition_date", date)
      .eq("status", "ready")
      .maybeSingle();

    if (editionError || !edition) {
      return Response.json(
        { error: "No ready edition for date", editionDate: date },
        { status: 404 }
      );
    }

    const result = await ensureStoryOfSectionForEdition(admin, {
      editionId: edition.id,
      location: {
        city,
        state: location?.state ?? null,
        region: location?.region ?? null,
        lat: clientLocation?.lat ?? location?.lat,
        lon: clientLocation?.lon ?? location?.lon,
      },
    });

    return Response.json({
      editionId: edition.id,
      editionDate: date,
      ...result,
    });
  } catch (err) {
    console.error("[ensure-story-of-section] failure", err);
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
});
