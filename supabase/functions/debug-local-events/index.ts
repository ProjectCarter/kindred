// Kindred — debug-local-events
// One-shot server/provider probe for getLocalEvents. Returns stage counts and
// a sanitized SerpAPI sample — never exposes the API key.

import {
  getLocalEvents,
  probeLocalEventsPipeline,
  type LocalEventLocation,
} from "../_shared/localEvents/provider.ts";
import { refreshEventsSection } from "../_shared/liveRefresh.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { isUsHolidayOrEve } from "../_shared/calendar/holidays.ts";

type ProbeRequest = {
  location?: Partial<LocalEventLocation>;
  editionDate?: string;
  cityQuery?: string;
  htichips?: string | null;
  backfillEditionId?: string;
  backfillUserId?: string;
};

Deno.serve(async (req) => {
  try {
    let body: ProbeRequest = {};
    try {
      body = (await req.json()) as ProbeRequest;
    } catch {
      // optional body — default to Gilbert
    }

    const location: LocalEventLocation = {
      lat: Number(body.location?.lat ?? 33.274823),
      lon: Number(body.location?.lon ?? -111.776872),
      city: String(body.location?.city ?? body.cityQuery ?? "Gilbert"),
      region: body.location?.region ?? "AZ",
      state: body.location?.state ?? "AZ",
    };

    if (body.cityQuery?.trim()) {
      location.city = body.cityQuery.trim();
    }

    const editionDate =
      typeof body.editionDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(body.editionDate)
        ? body.editionDate
        : "2026-07-14";

    const [y, m, d] = editionDate.split("-").map(Number);
    const dateObj = new Date(y, (m ?? 1) - 1, d ?? 1);
    const dow = dateObj.getDay();
    const isBusyDay =
      dow === 0 || dow === 6 || isUsHolidayOrEve(dateObj);

    const [probe, productionEvents] = await Promise.all([
      probeLocalEventsPipeline(location, {
        isBusyDay,
        htichips: body.htichips,
      }),
      getLocalEvents(location, { isBusyDay }),
    ]);

    let backfill: { ok: boolean; changed: boolean; count: number; error?: string } | null =
      null;
    if (body.backfillEditionId && body.backfillUserId) {
      const url = Deno.env.get("SUPABASE_URL");
      const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (url && key) {
        const admin = createClient(url, key);
        backfill = await refreshEventsSection(admin, {
          editionId: body.backfillEditionId,
          userId: body.backfillUserId,
          editionDate,
          location,
        });
      }
    }

    return Response.json({
      ok: true,
      editionDate,
      isBusyDay,
      probe,
      productionEventCount: productionEvents.length,
      backfill,
    });
  } catch (err) {
    console.error("[debug-local-events] failure", err);
    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
});
