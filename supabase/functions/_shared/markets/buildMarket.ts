import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { registerEventsMetro } from "../localEvents/eventsCatalogSync.ts";
import { syncEventsCatalogForMetro } from "../localEvents/eventsCatalogSync.ts";
import {
  registerActivitiesMetro,
  syncActivitiesCatalogForMetro,
} from "../places/activitiesCatalogSync.ts";
import {
  registerFoodDrinkMetro,
  syncFoodDrinkCatalogForMetro,
} from "../places/foodDrinkCatalogSync.ts";
import {
  assessUsMarketCompleteness,
  isMarketSupported,
  marketStatusFromCompleteness,
  validateUsMarketOnly,
  type MarketCompletenessReport,
  type UsMarketRow,
} from "./marketCompleteness.ts";
import { assertUsCountryCode, MARKET_BUILD_LOCK_MS } from "./usOnly.ts";

/** Batch controls — intentionally disabled for V1 rollout infrastructure. */
export function assertBatchMarketActionsAllowed(): void {
  throw new Error(
    "Batch market actions are disabled until explicitly approved. Build one market at a time."
  );
}

export type BuildMarketResult =
  | {
      ok: true;
      marketId: string;
      slug: string;
      status: string;
      completeness: MarketCompletenessReport;
      logId: string;
      durationMs: number;
      apiCallCounts: Record<string, number>;
      estimatedCostUsd: number | null;
      costAvailable: boolean;
    }
  | { ok: false; error: string; code?: string };

type MarketRow = UsMarketRow & {
  state_name: string;
  build_lock_token: string | null;
  build_lock_expires_at: string | null;
};

function locationFromMarket(market: MarketRow) {
  return {
    city: market.primary_city,
    state: market.state_code,
    region: market.state_name,
    lat: market.latitude,
    lon: market.longitude,
  };
}

async function loadMarket(
  admin: SupabaseClient,
  slug: string
): Promise<MarketRow | null> {
  const { data, error } = await admin
    .from("kindred_us_markets")
    .select(
      "id, slug, metro_key, market_name, primary_city, state_name, state_code, country_code, latitude, longitude, default_radius_miles, fallback_radius_miles, status, build_lock_token, build_lock_expires_at"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as MarketRow | null) ?? null;
}

async function acquireBuildLock(
  admin: SupabaseClient,
  market: MarketRow,
  lockToken: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = Date.now();
  const expires = new Date(now + MARKET_BUILD_LOCK_MS).toISOString();

  if (
    market.status === "building" &&
    market.build_lock_expires_at &&
    new Date(market.build_lock_expires_at).getTime() > now
  ) {
    return {
      ok: false,
      error: "Market build already in progress — retry after the current run finishes.",
    };
  }

  const { error } = await admin
    .from("kindred_us_markets")
    .update({
      status: "building",
      build_lock_token: lockToken,
      build_lock_expires_at: expires,
      updated_at: new Date().toISOString(),
    })
    .eq("id", market.id)
    .eq("country_code", "US");

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function releaseBuildLock(
  admin: SupabaseClient,
  marketId: string,
  lockToken: string
): Promise<void> {
  await admin
    .from("kindred_us_markets")
    .update({
      build_lock_token: null,
      build_lock_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", marketId)
    .eq("build_lock_token", lockToken);
}

async function createBuildLog(
  admin: SupabaseClient,
  market: MarketRow,
  jobType: "build" | "refresh" | "retry",
  retryCount: number
): Promise<string> {
  const { data, error } = await admin
    .from("kindred_market_build_logs")
    .insert({
      market_id: market.id,
      slug: market.slug,
      state_code: market.state_code,
      country_code: "US",
      job_type: jobType,
      status: "running",
      sections_requested: [
        "local_events",
        "activities",
        "food_drinks",
        "story_of",
        "bandits_pick",
        "today_in_history",
        "artwork",
        "maps",
        "coordinates",
        "editorial_quality",
        "family_safe",
      ],
      retry_count: retryCount,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "Could not create market build log");
  }
  return data.id as string;
}

async function finalizeBuildLog(
  admin: SupabaseClient,
  logId: string,
  input: {
    status: "succeeded" | "failed" | "partial";
    startedAt: number;
    sectionsCompleted: string[];
    sectionsMissing: string[];
    apiCallCounts: Record<string, number>;
    estimatedCostUsd: number | null;
    costAvailable: boolean;
    errorDetails?: string | null;
    completeness: MarketCompletenessReport;
  }
): Promise<void> {
  const endedAt = new Date().toISOString();
  const durationMs = Date.now() - input.startedAt;
  await admin
    .from("kindred_market_build_logs")
    .update({
      status: input.status,
      ended_at: endedAt,
      duration_ms: durationMs,
      sections_completed: input.sectionsCompleted,
      sections_missing: input.sectionsMissing,
      api_providers: Object.keys(input.apiCallCounts),
      api_call_counts: input.apiCallCounts,
      estimated_cost_usd: input.estimatedCostUsd,
      cost_available: input.costAvailable,
      error_details: input.errorDetails ?? null,
      completeness: input.completeness,
    })
    .eq("id", logId);
}

/**
 * Build Market — initialize reusable evergreen foundation for one US market.
 * Reuses existing catalog sync pipelines; does not generate user editions.
 */
export async function buildUsMarket(
  admin: SupabaseClient,
  input: {
    slug: string;
    jobType?: "build" | "refresh" | "retry";
    retryCount?: number;
    skipCatalogSync?: boolean;
  }
): Promise<BuildMarketResult> {
  const startedAt = Date.now();
  const jobType = input.jobType ?? "build";
  const lockToken = crypto.randomUUID();

  const market = await loadMarket(admin, input.slug);
  if (!market) {
    return { ok: false, error: `Unknown US market slug: ${input.slug}` };
  }

  try {
    assertUsCountryCode(market.country_code, "build market");
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      code: "NON_US_MARKET",
    };
  }

  if (market.status === "paused") {
    return { ok: false, error: "Market is paused — enable it before building." };
  }

  const lock = await acquireBuildLock(admin, market, lockToken);
  if (!lock.ok) {
    return { ok: false, error: lock.error, code: "BUILD_IN_PROGRESS" };
  }

  let logId = "";
  const apiCallCounts: Record<string, number> = {};
  let estimatedCostUsd: number | null = null;
  let costAvailable = false;
  const sectionsCompleted: string[] = [];
  const sectionsMissing: string[] = [];
  let syncError: string | null = null;

  try {
    logId = await createBuildLog(
      admin,
      market,
      jobType,
      input.retryCount ?? 0
    );

    const loc = locationFromMarket(market);

    await registerEventsMetro(admin, loc);
    await registerActivitiesMetro(admin, loc);
    await registerFoodDrinkMetro(admin, loc);

    if (!input.skipCatalogSync) {
      const { data: eventsMetro } = await admin
        .from("events_catalog_metros")
        .select("*")
        .eq("metro_key", market.metro_key)
        .maybeSingle();

      if (eventsMetro) {
        try {
          const mode =
            eventsMetro.initial_import_completed_at ? "incremental" : "full";
          const stats = await syncEventsCatalogForMetro(
            admin,
            eventsMetro,
            mode
          );
          apiCallCounts.eventbrite = (apiCallCounts.eventbrite ?? 0) + stats.apiCalls;
          if (stats.estimatedCostUsd > 0) {
            estimatedCostUsd = (estimatedCostUsd ?? 0) + stats.estimatedCostUsd;
            costAvailable = true;
          }
        } catch (err) {
          syncError = `events sync: ${err instanceof Error ? err.message : String(err)}`;
        }
      }

      const { data: activitiesMetro } = await admin
        .from("activities_catalog_metros")
        .select("*")
        .eq("metro_key", market.metro_key)
        .maybeSingle();

      if (activitiesMetro) {
        try {
          const mode =
            activitiesMetro.initial_import_completed_at ? "incremental" : "full";
          const stats = await syncActivitiesCatalogForMetro(
            admin,
            activitiesMetro,
            mode
          );
          apiCallCounts.foursquare = (apiCallCounts.foursquare ?? 0) + stats.apiCalls;
          if (stats.estimatedCostUsd > 0) {
            estimatedCostUsd = (estimatedCostUsd ?? 0) + stats.estimatedCostUsd;
            costAvailable = true;
          }
        } catch (err) {
          syncError = syncError
            ? `${syncError}; activities sync failed`
            : `activities sync: ${err instanceof Error ? err.message : String(err)}`;
        }
      }

      const { data: foodMetro } = await admin
        .from("food_drink_catalog_metros")
        .select("*")
        .eq("metro_key", market.metro_key)
        .maybeSingle();

      if (foodMetro) {
        try {
          const mode = foodMetro.initial_import_completed_at ? "incremental" : "full";
          const stats = await syncFoodDrinkCatalogForMetro(
            admin,
            foodMetro,
            mode
          );
          apiCallCounts.foursquare = (apiCallCounts.foursquare ?? 0) + stats.apiCalls;
          if (stats.estimatedCostUsd > 0) {
            estimatedCostUsd = (estimatedCostUsd ?? 0) + stats.estimatedCostUsd;
            costAvailable = true;
          }
        } catch (err) {
          syncError = syncError
            ? `${syncError}; food sync failed`
            : `food sync: ${err instanceof Error ? err.message : String(err)}`;
        }
      }
    }

    const completeness = await assessUsMarketCompleteness(admin, market);
    for (const section of completeness.sections) {
      if (section.complete) sectionsCompleted.push(section.id);
      else if (section.required) sectionsMissing.push(section.id);
    }

    const durationMs = Date.now() - startedAt;
    const nextStatus = marketStatusFromCompleteness(completeness, market.status);

    await admin
      .from("kindred_us_markets")
      .update({
        status: nextStatus,
        is_supported: isMarketSupported(completeness),
        last_built_at: new Date().toISOString(),
        ...(jobType === "refresh"
          ? { last_refreshed_at: new Date().toISOString() }
          : {}),
        last_success_at: completeness.foundationComplete
          ? new Date().toISOString()
          : null,
        last_failure_at: completeness.complete ? null : new Date().toISOString(),
        last_error: syncError ?? (completeness.complete ? null : completeness.deficiencies.join("; ")),
        last_build_duration_ms: durationMs,
        completeness,
        updated_at: new Date().toISOString(),
      })
      .eq("id", market.id);

    const logStatus =
      syncError && !completeness.foundationComplete
        ? "failed"
        : syncError
        ? "partial"
        : completeness.complete
        ? "succeeded"
        : completeness.foundationComplete
        ? "partial"
        : "partial";

    await finalizeBuildLog(admin, logId, {
      status: logStatus,
      startedAt,
      sectionsCompleted,
      sectionsMissing,
      apiCallCounts,
      estimatedCostUsd,
      costAvailable,
      errorDetails: syncError,
      completeness,
    });

    return {
      ok: true,
      marketId: market.id,
      slug: market.slug,
      status: nextStatus,
      completeness,
      logId,
      durationMs,
      apiCallCounts,
      estimatedCostUsd,
      costAvailable,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const completeness = await assessUsMarketCompleteness(admin, market).catch(
      () => null
    );

    await admin
      .from("kindred_us_markets")
      .update({
        status: "needs_attention",
        last_failure_at: new Date().toISOString(),
        last_error: message,
        last_build_duration_ms: Date.now() - startedAt,
        completeness,
        updated_at: new Date().toISOString(),
      })
      .eq("id", market.id);

    if (logId) {
      await finalizeBuildLog(admin, logId, {
        status: "failed",
        startedAt,
        sectionsCompleted,
        sectionsMissing,
        apiCallCounts,
        estimatedCostUsd,
        costAvailable,
        errorDetails: message,
        completeness:
          completeness ??
          ({
            complete: false,
            foundationComplete: false,
            needsAttention: true,
            sections: [],
            deficiencies: [message],
          } as MarketCompletenessReport),
      });
    }

    return { ok: false, error: message };
  } finally {
    await releaseBuildLock(admin, market.id, lockToken);
  }
}

export type ManageUsMarketResult =
  | { ok: true; slug: string; status: string }
  | { ok: false; error: string; code?: string };

/** Pause or enable one US market — dev ops only. */
export async function manageUsMarket(
  admin: SupabaseClient,
  input: { slug: string; action: "pause" | "enable" }
): Promise<ManageUsMarketResult> {
  const { data: market, error } = await admin
    .from("kindred_us_markets")
    .select("id, slug, country_code, status")
    .eq("slug", input.slug)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!market) return { ok: false, error: `Unknown US market: ${input.slug}` };

  try {
    assertUsCountryCode(market.country_code, "manage market");
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      code: "NON_US_MARKET",
    };
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.action === "pause") {
    patch.status = "paused";
    patch.is_daily_refresh_enabled = false;
  } else {
    patch.status = market.status === "paused" ? "planned" : market.status;
  }

  const { error: updateError } = await admin
    .from("kindred_us_markets")
    .update(patch)
    .eq("id", market.id)
    .eq("country_code", "US");

  if (updateError) return { ok: false, error: updateError.message };

  return {
    ok: true,
    slug: market.slug,
    status: String(patch.status ?? market.status),
  };
}

export type ValidateMarketResult =
  | {
      ok: true;
      slug: string;
      status: string;
      completeness: MarketCompletenessReport;
    }
  | { ok: false; error: string; code?: string };

/** Validate one market — read-only assessment, zero API spend. */
export async function validateUsMarket(
  admin: SupabaseClient,
  slug: string
): Promise<ValidateMarketResult> {
  const market = await loadMarket(admin, slug);
  if (!market) {
    return { ok: false, error: `Unknown US market slug: ${slug}` };
  }

  try {
    assertUsCountryCode(market.country_code, "validate market");
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      code: "NON_US_MARKET",
    };
  }

  const completeness = await validateUsMarketOnly(admin, market);
  const nextStatus = marketStatusFromCompleteness(completeness, market.status);

  await admin
    .from("kindred_us_markets")
    .update({
      status: nextStatus,
      is_supported: isMarketSupported(completeness),
      completeness,
      updated_at: new Date().toISOString(),
    })
    .eq("id", market.id);

  return {
    ok: true,
    slug: market.slug,
    status: nextStatus,
    completeness,
  };
}
