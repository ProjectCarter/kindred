// Kindred — process-user-edition-job
// Background worker for a single on-demand edition build.
// Invoked fire-and-forget from generate-edition (service role) or cron secret.

import { createServiceClient } from "../_shared/buildEdition.ts";
import {
  isCronAuthorized,
} from "../_shared/auth/cronSecret.ts";
import {
  runUserGenerationJob,
  type RunUserGenerationJobInput,
} from "../_shared/edition/runUserGenerationJob.ts";
import type { TemperatureUnitPreference } from "../_shared/weather/units.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function isWorkerAuthorized(req: Request): boolean {
  if (isCronAuthorized(req)) return true;
  const auth = req.headers.get("Authorization");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return Boolean(serviceKey && auth === `Bearer ${serviceKey}`);
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    if (!isWorkerAuthorized(req)) {
      return json({ error: "Unauthorized" }, 401);
    }

    type WorkerLocationPayload = {
      city?: string;
      state?: string | null;
      region?: string | null;
      lat?: number;
      lon?: number;
    };

    const body = (await req.json().catch(() => ({}))) as {
      userId?: string;
      editionDate?: string;
      metroKey?: string;
      editionTraceId?: string | null;
      temperatureUnit?: TemperatureUnitPreference;
      location?: WorkerLocationPayload;
      locationHint?: WorkerLocationPayload;
    };

    const userId = body.userId?.trim();
    const editionDate = body.editionDate?.trim();
    const metroKey = body.metroKey?.trim();

    if (!userId || !editionDate || !/^\d{4}-\d{2}-\d{2}$/.test(editionDate) || !metroKey) {
      return json({ error: "userId, editionDate (YYYY-MM-DD), and metroKey required" }, 400);
    }

    const locationPayload = body.location ?? body.locationHint;
    const locationHint =
      locationPayload &&
      typeof locationPayload.lat === "number" &&
      typeof locationPayload.lon === "number" &&
      locationPayload.city?.trim()
        ? {
            city: locationPayload.city.trim(),
            state: locationPayload.state ?? null,
            region: locationPayload.region ?? null,
            lat: locationPayload.lat,
            lon: locationPayload.lon,
          }
        : null;

    console.log("[process-user-edition-job] location received", {
      userId,
      metroKey,
      source: body.location ? "location" : body.locationHint ? "locationHint" : "none",
      city: locationHint?.city ?? null,
      lat: locationHint?.lat ?? null,
      lon: locationHint?.lon ?? null,
    });

    const admin = createServiceClient();
    const started = performance.now();

    const result = await runUserGenerationJob(admin, {
      userId,
      editionDate,
      metroKey,
      editionTraceId: body.editionTraceId ?? null,
      temperatureUnitPreference: body.temperatureUnit ?? "auto",
      locationHint,
      forceRefreshSections: Array.isArray(body.forceRefreshSections)
        ? body.forceRefreshSections.filter(
            (value: unknown): value is string => typeof value === "string"
          )
        : null,
    });

    console.log("[process-user-edition-job] finished", {
      userId,
      editionDate,
      metroKey,
      ok: result.ok,
      skipped: "skipped" in result ? result.skipped : undefined,
      ms: Math.round(performance.now() - started),
    });

    if (result.ok) {
      return json({
        success: true,
        editionId: result.editionId,
        metroKey: result.metroKey,
        skipped: result.skipped ?? null,
      });
    }

    if (result.skipped === "already_processing" || result.skipped === "not_claimable") {
      return json({ success: true, skipped: result.skipped }, 200);
    }

    return json({ error: result.error, skipped: result.skipped ?? null }, 500);
  } catch (err) {
    console.error("[process-user-edition-job] failure", err);
    return json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      500
    );
  }
});
