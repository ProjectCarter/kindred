// Kindred — refresh-discovery
// Lightweight pass: recompute the rule-based Discovery Engine payload
// (Weekend Escapes / Bandit's Notebook / Recommendations source data) and
// update only the `discovery` column on an already-ready edition. No
// NewsAPI or Claude calls — avoids the full edition rebuild's compute cost.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  createServiceClient,
  getLocalEvents,
  resolveEditionLocation,
} from "../_shared/buildEdition.ts";
import { runDiscoveryDecisions } from "../_shared/discovery/index.ts";
import { isUsHolidayOrEve } from "../_shared/calendar/holidays.ts";
import { getLocalPlaces } from "../_shared/places/index.ts";

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
    const [dy, dm, dd] = date.split("-").map(Number);
    const dateObj = new Date(dy, (dm ?? 1) - 1, dd ?? 1);
    const dayOfWeek = dateObj.getDay();
    const isSaturday = dayOfWeek === 6;
    const isSunday = dayOfWeek === 0;
    const isWeekend = isSaturday || isSunday;
    const isBusyDay = isWeekend || isUsHolidayOrEve(dateObj);

    const { data: profile } = await admin
      .from("profiles")
      .select("interests")
      .eq("id", user.id)
      .maybeSingle();
    const interests: string[] = profile?.interests ?? [];

    const [localEvents, localPlaces] = await Promise.all([
      getLocalEvents(location, { isBusyDay }),
      // Shared per-metro cache — almost never actually calls Foursquare.
      getLocalPlaces(admin, location),
    ]);

    const discovery = runDiscoveryDecisions({
      editionDate: date,
      now: new Date(),
      city: location.city,
      region: location.region ?? null,
      state: location.state ?? null,
      interests,
      followedTopics: [],
      favoriteSources: [],
      isWeekend,
      isSunday,
      localEvents: localEvents.map((e) => ({
        name: e.name,
        startDateTime: e.startDateTime,
        venue: e.venue,
        city: e.city,
        sourceUrl: e.sourceUrl,
        sourceName: e.sourceName,
      })),
      localPlaces,
      recentKeys: [],
    });

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

    const { error: updateError } = await admin
      .from("editions")
      .update({ discovery })
      .eq("id", edition.id);

    if (updateError) {
      return Response.json({ error: updateError.message }, { status: 500 });
    }

    return Response.json({
      ok: true,
      editionId: edition.id,
      editionDate: date,
      isWeekend,
      isBusyDay,
      localPlacesCount: localPlaces.length,
      surfaces: Object.keys(discovery.surfaces),
      selectedCount: discovery.selectionMeta.selectedCount,
      candidateCount: discovery.selectionMeta.candidateCount,
    });
  } catch (err) {
    console.error("[refresh-discovery] failure", err);
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
});
