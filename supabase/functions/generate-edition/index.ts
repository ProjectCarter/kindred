// Kindred — generate-edition
// On-demand edition request: validate location, enqueue job, trigger background worker.
// Returns immediately — client polls until the edition is ready.

import {
  createServiceClient,
  resolveEditionLocation,
} from "../_shared/buildEdition.ts";
import {
  assertLocationMatchesMarket,
  resolveEditionMarket,
} from "../_shared/markets/editionMarket.ts";
import { generationJobsConflictTarget } from "../_shared/markets/editionIdentity.ts";
import { findReadyEditionId } from "../_shared/edition/runUserGenerationJob.ts";
import { triggerUserEditionJobWorker } from "../_shared/edition/triggerUserEditionJobWorker.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type { TemperatureUnitPreference } from "../_shared/weather/units.ts";

type ClientLocation = {
  city?: string;
  region?: string | null;
  state?: string | null;
  lat?: number;
  lon?: number;
};

type JobTracker = {
  admin: SupabaseClient;
  userId: string;
  jobDate: string;
  metroKey: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function upsertGenerationJob(
  tracker: JobTracker,
  patch: {
    status: "pending" | "processing" | "ready" | "failed";
    last_error?: string | null;
    attempts?: number;
  }
) {
  await tracker.admin.from("generation_jobs").upsert(
    {
      user_id: tracker.userId,
      edition_date: tracker.jobDate,
      metro_key: tracker.metroKey,
      status: patch.status,
      last_error: patch.last_error ?? null,
      attempts: patch.attempts ?? 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: generationJobsConflictTarget() }
  );
}

Deno.serve(async (req) => {
  let jobTracker: JobTracker | null = null;

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error("[generate-edition] missing SUPABASE_URL or SERVICE_ROLE_KEY");
      return json(
        { error: "Server configuration incomplete. Missing Supabase credentials." },
        500
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing auth" }, 401);
    }

    const supabaseUser = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return json({ error: "Not authenticated" }, 401);
    }

    let clientLocation: ClientLocation | null = null;
    let editionDate: string | null = null;
    let temperatureUnitPreference: TemperatureUnitPreference | null = null;
    let devPreview = false;
    let editionTraceId: string | null = null;
    let forceRefreshSections: string[] | null = null;

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
      devPreview = body?.devPreview === true;
      if (typeof body?.editionTraceId === "string" && body.editionTraceId.trim()) {
        editionTraceId = body.editionTraceId.trim();
      }
      if (devPreview && Array.isArray(body?.forceRefreshSections)) {
        forceRefreshSections = body.forceRefreshSections
          .filter((value: unknown): value is string => typeof value === "string")
          .map((value: string) => value.trim())
          .filter(Boolean);
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
      return json(
        {
          error:
            "location_required — send { location: { city, lat, lon } } from the device. Kindred never invents a city.",
        },
        400
      );
    }

    const stateCode = clientLocation!.state?.trim().toUpperCase() ?? "";
    if (!/^[A-Z]{2}$/.test(stateCode)) {
      return json(
        {
          error:
            "Kindred is currently available in the United States. Choose a US city with a state code.",
          code: "NON_US_REGION",
        },
        403
      );
    }

    const locationHint = {
      lat: clientLocation!.lat!,
      lon: clientLocation!.lon!,
      city: clientLocation!.city!.trim(),
      region: clientLocation!.region ?? null,
      state: clientLocation!.state ?? null,
    };

    const resolvedMarket = resolveEditionMarket(locationHint);
    if (!resolvedMarket) {
      return json(
        {
          error:
            "Unsupported market — Kindred could not resolve a US market for this location.",
          code: "UNSUPPORTED_MARKET",
        },
        400
      );
    }

    const locationConsistency = assertLocationMatchesMarket(
      locationHint,
      resolvedMarket
    );
    if (!locationConsistency.ok) {
      return json(
        {
          error:
            "Location mismatch — city label and coordinates must belong to the same market.",
          code: "LOCATION_MARKET_MISMATCH",
          reason: locationConsistency.reason,
        },
        400
      );
    }

    const supabaseAdmin = createServiceClient();

    const jobDate =
      editionDate && /^\d{4}-\d{2}-\d{2}$/.test(editionDate)
        ? editionDate
        : new Date().toISOString().slice(0, 10);

    jobTracker = {
      admin: supabaseAdmin,
      userId: user.id,
      jobDate,
      metroKey: resolvedMarket.metroKey,
    };

    const readyEditionId = await findReadyEditionId(supabaseAdmin, {
      userId: user.id,
      editionDate: jobDate,
      metroKey: resolvedMarket.metroKey,
    });

    if (readyEditionId) {
      return json({
        success: true,
        alreadyReady: true,
        async: false,
        editionId: readyEditionId,
        metroKey: resolvedMarket.metroKey,
        editionDate: jobDate,
        location: {
          city: locationHint.city,
          region: locationHint.region,
          state: locationHint.state,
        },
      });
    }

    const { data: existingJob } = await supabaseAdmin
      .from("generation_jobs")
      .select("status, attempts, last_error")
      .eq("user_id", user.id)
      .eq("edition_date", jobDate)
      .eq("metro_key", resolvedMarket.metroKey)
      .maybeSingle();

    if (existingJob?.status === "processing" || existingJob?.status === "pending") {
      triggerUserEditionJobWorker({
        userId: user.id,
        editionDate: jobDate,
        metroKey: resolvedMarket.metroKey,
        editionTraceId,
        temperatureUnitPreference: temperatureUnitPreference ?? "auto",
        locationHint,
        forceRefreshSections,
      });

      return json(
        {
          accepted: true,
          async: true,
          status: existingJob.status,
          editionDate: jobDate,
          metroKey: resolvedMarket.metroKey,
          pollIntervalMs: 5000,
        },
        202
      );
    }

    if (!devPreview) {
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
    }

    const location = await resolveEditionLocation(
      supabaseAdmin,
      user.id,
      locationHint
    );

    if (!location) {
      await upsertGenerationJob(jobTracker, {
        status: "failed",
        last_error: "No location set. Choose a home city or enable current location.",
      });
      return json(
        {
          error:
            "No location set. Choose a home city or enable current location.",
        },
        400
      );
    }

    await upsertGenerationJob(jobTracker, {
      status: "pending",
      last_error: null,
      attempts: existingJob?.status === "failed" ? existingJob.attempts ?? 0 : 0,
    });

    console.log("[generate-edition] enqueued", {
      traceId: editionTraceId,
      userId: user.id,
      editionDate: jobDate,
      metroKey: resolvedMarket.metroKey,
      city: location.city,
    });

    triggerUserEditionJobWorker({
      userId: user.id,
      editionDate: jobDate,
      metroKey: resolvedMarket.metroKey,
      editionTraceId,
      temperatureUnitPreference: temperatureUnitPreference ?? "auto",
      locationHint,
      forceRefreshSections,
    });

    return json(
      {
        accepted: true,
        async: true,
        status: "pending",
        editionDate: jobDate,
        metroKey: resolvedMarket.metroKey,
        location: {
          city: location.city,
          region: location.region,
          state: location.state,
        },
        pollIntervalMs: 5000,
      },
      202
    );
  } catch (err) {
    console.error("[generate-edition] failure", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    if (jobTracker) {
      try {
        await upsertGenerationJob(jobTracker, {
          status: "failed",
          last_error: message,
        });
      } catch (jobErr) {
        console.error("[generate-edition] failed to mark job failed", jobErr);
      }
    }
    return json({ error: message }, 500);
  }
});
