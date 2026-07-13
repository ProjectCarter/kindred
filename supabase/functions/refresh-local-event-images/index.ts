// Kindred — refresh-local-event-images
// Lightweight pass: re-fetch SerpAPI events (with images) and upsert only
// the local_events section. Avoids full edition rebuild OOM on free-tier workers.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  buildLocalEventsBody,
  getLocalEvents,
  type LocalEvent,
} from "../_shared/localEvents/provider.ts";
import { enrichEventsWithBanditNotes } from "../_shared/localEvents/banditNotes.ts";
import { isUsHolidayOrEve } from "../_shared/calendar/holidays.ts";

type ClientLocation = {
  city?: string;
  region?: string | null;
  state?: string | null;
  lat?: number;
  lon?: number;
};

function createServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing Supabase credentials");
  return createClient(url, key);
}

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
    let location = null as {
      lat: number;
      lon: number;
      city: string;
      region?: string | null;
      state?: string | null;
    } | null;

    if (
      clientLocation &&
      typeof clientLocation.lat === "number" &&
      typeof clientLocation.lon === "number" &&
      typeof clientLocation.city === "string" &&
      clientLocation.city.trim() &&
      clientLocation.city.trim().toLowerCase() !== "your area"
    ) {
      location = {
        lat: clientLocation.lat,
        lon: clientLocation.lon,
        city: clientLocation.city.trim(),
        region: clientLocation.region ?? null,
        state: clientLocation.state ?? null,
      };
    } else {
      const { data: profile } = await admin
        .from("profiles")
        .select("location, home_location")
        .eq("id", user.id)
        .maybeSingle();
      const blob =
        (profile?.location as ClientLocation | null) ??
        (profile?.home_location as ClientLocation | null);
      if (
        blob &&
        typeof blob.lat === "number" &&
        typeof blob.lon === "number" &&
        typeof blob.city === "string" &&
        blob.city.trim()
      ) {
        location = {
          lat: blob.lat,
          lon: blob.lon,
          city: blob.city.trim(),
          region: blob.region ?? null,
          state: blob.state ?? null,
        };
      }
    }

    if (!location) {
      return Response.json({ error: "location_required" }, { status: 400 });
    }

    const date =
      editionDate ??
      new Date().toLocaleDateString("en-CA", { timeZone: "America/Phoenix" });
    const [dy, dm, dd] = date.split("-").map(Number);
    const dateObj = new Date(dy, (dm ?? 1) - 1, dd ?? 1);
    const dayOfWeek = dateObj.getDay();
    const isBusyDay =
      dayOfWeek === 0 || dayOfWeek === 6 || isUsHolidayOrEve(dateObj);

    const fetched: LocalEvent[] = await getLocalEvents(location, {
      isBusyDay,
    });
    const events = await enrichEventsWithBanditNotes(fetched);

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

    if (events.length === 0) {
      return Response.json({
        ok: true,
        editionId: edition.id,
        events: [],
        eventsWithImages: 0,
        note: "Provider returned zero events — section left unchanged",
      });
    }

    const body = buildLocalEventsBody(events);
    const { data: existing } = await admin
      .from("edition_sections")
      .select("id, position")
      .eq("edition_id", edition.id)
      .eq("section_type", "local_events")
      .maybeSingle();

    if (existing?.id) {
      const { error: updateError } = await admin
        .from("edition_sections")
        .update({
          headline: "Local Events",
          body,
          source_note: "Sourced from Google Events via SerpApi",
        })
        .eq("id", existing.id);
      if (updateError) {
        return Response.json({ error: updateError.message }, { status: 500 });
      }
    } else {
      const { data: maxPos } = await admin
        .from("edition_sections")
        .select("position")
        .eq("edition_id", edition.id)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      const position = (maxPos?.position ?? 0) + 1;
      const { error: insertError } = await admin.from("edition_sections").insert({
        edition_id: edition.id,
        section_type: "local_events",
        position,
        headline: "Local Events",
        body,
        source_note: "Sourced from Google Events via SerpApi",
      });
      if (insertError) {
        return Response.json({ error: insertError.message }, { status: 500 });
      }
    }

    const parsed = JSON.parse(body) as {
      events: Array<{
        name: string;
        imageUrl?: string | null;
        imageSource?: string | null;
      }>;
    };

    return Response.json({
      ok: true,
      editionId: edition.id,
      editionDate: date,
      events: parsed.events.map((e) => ({
        name: e.name,
        imageUrl: e.imageUrl ?? null,
        imageSource: e.imageSource ?? null,
        hasImage: Boolean(e.imageUrl),
      })),
      eventsWithImages: parsed.events.filter((e) => Boolean(e.imageUrl)).length,
    });
  } catch (err) {
    console.error("[refresh-local-event-images] failure", err);
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
});
