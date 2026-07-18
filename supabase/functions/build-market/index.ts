// Kindred — build-market
// Dev / ops: catalog bootstrap, refresh, and market status for one US market.

import { createServiceClient } from "../_shared/buildEdition.ts";
import {
  assertBatchMarketActionsAllowed,
  buildUsMarket,
  manageUsMarket,
  validateUsMarket,
} from "../_shared/markets/buildMarket.ts";

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
      action?: "build" | "refresh" | "retry" | "pause" | "enable" | "validate";
      retryCount?: number;
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

    const jobType =
      action === "refresh" ? "refresh" : action === "retry" ? "retry" : "build";

    const result = await buildUsMarket(admin, {
      slug,
      jobType,
      retryCount: body.retryCount ?? (action === "retry" ? 1 : 0),
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
