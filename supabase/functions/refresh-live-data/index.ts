// Kindred — refresh-live-data
//
// The client calls this, fire-and-forget, right after opening an already-
// ready edition. It refreshes only the structured, factual layer (event
// times/cancellations/ticket links, which cached places currently qualify)
// and never touches the printed AI copy — no Anthropic calls, no full
// rebuild. See _shared/liveRefresh.ts for exactly what it does and doesn't
// touch, and why.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  createServiceClient,
  resolveEditionLocation,
} from "../_shared/buildEdition.ts";
import { refreshLiveDataForEdition } from "../_shared/liveRefresh.ts";

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
    let editionDate: string | null = null;
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
    if (!location) {
      return Response.json({ error: "location_required" }, { status: 400 });
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
        {
          error: "No ready edition for date",
          editionDate: date,
          detail: editionError?.message ?? null,
        },
        { status: 404 }
      );
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("interests")
      .eq("id", user.id)
      .maybeSingle();

    const result = await refreshLiveDataForEdition(admin, {
      editionId: edition.id,
      userId: user.id,
      editionDate: date,
      location,
      interests: profile?.interests ?? [],
    });

    await admin
      .from("editions")
      .update({ live_refreshed_at: new Date().toISOString() })
      .eq("id", edition.id);

    return Response.json({
      ok: true,
      editionId: edition.id,
      editionDate: date,
      changed: result.events.changed || result.discovery.changed,
      ...result,
    });
  } catch (err) {
    console.error("[refresh-live-data] failure", err);
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
});
