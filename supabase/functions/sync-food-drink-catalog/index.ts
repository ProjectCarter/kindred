// Kindred — sync-food-drink-catalog
// Scheduled server-side Food & Drink catalog sync (daily incremental, weekly full).
// Auth: CRON_SECRET — never called from the client app.

import { createServiceClient } from "../_shared/editionRuntime.ts";
import {
  listFoodDrinkMetrosForSync,
  syncFoodDrinkCatalogForMetro,
} from "../_shared/places/foodDrinkCatalogSync.ts";
import type { CatalogSearchMode } from "../_shared/places/foursquareProvider.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function isAuthorized(req: Request): boolean {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret) return false;
  const headerSecret = req.headers.get("x-cron-secret");
  if (headerSecret && headerSecret === cronSecret) return true;
  const auth = req.headers.get("Authorization");
  return auth === `Bearer ${cronSecret}`;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }
    if (!isAuthorized(req)) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as {
      mode?: CatalogSearchMode;
      metroKey?: string;
    };
    const mode: CatalogSearchMode = body.mode === "full" ? "full" : "incremental";

    const admin = createServiceClient();
    const metros = await listFoodDrinkMetrosForSync(admin, {
      metroKey: body.metroKey ?? null,
    });

    if (!metros.length) {
      return json({
        ok: true,
        mode,
        message: "No metros registered for Food & Drink catalog sync",
        results: [],
      });
    }

    const results = [];
    for (const metro of metros) {
      const effectiveMode: CatalogSearchMode =
        mode === "full" || !metro.initial_import_completed_at ? "full" : "incremental";
      const stats = await syncFoodDrinkCatalogForMetro(admin, metro, effectiveMode);
      results.push(stats);
    }

    const totals = results.reduce(
      (acc, row) => ({
        apiCalls: acc.apiCalls + row.apiCalls,
        rawPlacesReturned: acc.rawPlacesReturned + row.rawPlacesReturned,
        newDiscovered: acc.newDiscovered + row.newDiscovered,
        changedUpdated: acc.changedUpdated + row.changedUpdated,
        existingSkipped: acc.existingSkipped + row.existingSkipped,
        estimatedCostUsd: acc.estimatedCostUsd + row.estimatedCostUsd,
      }),
      {
        apiCalls: 0,
        rawPlacesReturned: 0,
        newDiscovered: 0,
        changedUpdated: 0,
        existingSkipped: 0,
        estimatedCostUsd: 0,
      }
    );

    console.log("[foodDrink:catalog] scheduled run complete", {
      mode,
      metros: metros.length,
      ...totals,
    });

    return json({ ok: true, mode, metros: metros.length, totals, results });
  } catch (err) {
    console.error("[foodDrink:catalog] sync failure", err);
    return json(
      {
        error: err instanceof Error ? err.message : String(err),
      },
      500
    );
  }
});
