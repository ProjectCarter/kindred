// Kindred — build-market
// Dev / ops: catalog bootstrap, refresh, and market status for one US market.

import { createServiceClient } from "../_shared/buildEdition.ts";
import {
  assertBatchMarketActionsAllowed,
  buildUsMarket,
  manageUsMarket,
  validateUsMarket,
} from "../_shared/markets/buildMarket.ts";
import { runMarketBuildPhase } from "../_shared/markets/marketBuildPhases.ts";
import type { MarketBuildPhase } from "../../../lib/markets/marketBuildEngine.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const body = (await req.json().catch(() => ({}))) as {
      slug?: string;
      batch?: string;
      action?:
        | "build"
        | "refresh"
        | "retry"
        | "pause"
        | "enable"
        | "validate"
        | "phase";
      phase?: MarketBuildPhase;
      runId?: string;
      attempt?: number;
      dryRun?: boolean;
      retryCount?: number;
      syncCatalogs?: ("events" | "activities" | "food_drinks")[];
    };

    if (body.batch) {
      try {
        assertBatchMarketActionsAllowed();
      } catch (err) {
        return json(
          {
            error: err instanceof Error ? err.message : String(err),
            code: "BATCH_DISABLED",
          },
          403
        );
      }
    }

    const slug = body.slug?.trim();
    if (!slug) {
      return json({ error: "slug required — United States market slug" }, 400);
    }

    const admin = createServiceClient();
    const action = body.action ?? "build";

    if (action === "pause" || action === "enable") {
      const result = await manageUsMarket(admin, { slug, action });
      if (!result.ok) {
        return json(
          { error: result.error, code: result.code ?? "MANAGE_FAILED" },
          result.code === "NON_US_MARKET" ? 403 : 500
        );
      }
      return json({ success: true, slug: result.slug, status: result.status });
    }

    if (action === "validate") {
      const result = await validateUsMarket(admin, slug);
      if (!result.ok) {
        return json(
          { error: result.error, code: result.code ?? "VALIDATE_FAILED" },
          result.code === "NON_US_MARKET" ? 403 : 500
        );
      }
      return json({
        success: true,
        slug: result.slug,
        status: result.status,
        completeness: result.completeness,
        validated: true,
      });
    }

    if (action === "phase") {
      const phase = body.phase;
      if (!phase) {
        return json({ error: "phase required when action=phase" }, 400);
      }
      const runId = body.runId?.trim();
      if (!runId) {
        return json({ error: "runId required when action=phase" }, 400);
      }

      const result = await runMarketBuildPhase(admin, {
        slug,
        phase,
        runId,
        attempt: body.attempt ?? 1,
        dryRun: body.dryRun === true,
      });

      if (!result.ok) {
        return json(
          {
            error: result.error,
            code: result.code ?? "PHASE_FAILED",
            workerExitReason: result.workerExitReason,
          },
          result.code === "NON_US_MARKET" ? 403 : 500
        );
      }

      return json({
        success: true,
        slug: result.slug,
        metroKey: result.metroKey,
        runId: result.runId,
        phase: result.phase,
        skipped: result.skipped ?? false,
        status: result.status,
        completeness: result.completeness,
        durationMs: result.durationMs,
        rowsImported: result.rowsImported,
        apiCallCounts: result.apiCallCounts,
        warnings: result.warnings ?? [],
        bootstrapReconcile: result.bootstrapReconcile,
      });
    }

    const jobType =
      action === "refresh" ? "refresh" : action === "retry" ? "retry" : "build";

    const result = await buildUsMarket(admin, {
      slug,
      jobType,
      retryCount: body.retryCount ?? (action === "retry" ? 1 : 0),
      syncCatalogs: body.syncCatalogs,
    });

    if (!result.ok) {
      return json(
        { error: result.error, code: result.code ?? "BUILD_FAILED" },
        result.code === "NON_US_MARKET" ? 403 : 500
      );
    }

    return json({
      success: true,
      slug: result.slug,
      status: result.status,
      completeness: result.completeness,
      durationMs: result.durationMs,
      logId: result.logId,
      apiCallCounts: result.apiCallCounts,
      estimatedCostUsd: result.estimatedCostUsd,
      costAvailable: result.costAvailable,
    });
  } catch (err) {
    console.error("[build-market] failure", err);
    return json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      500
    );
  }
});
