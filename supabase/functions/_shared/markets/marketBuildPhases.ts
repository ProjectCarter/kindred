/**
 * Phased U.S. market build runner — one explicit phase per edge invocation.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  MARKET_BUILD_PHASES,
  PHASE_MAX_ATTEMPTS,
  STALE_LOCK_GRACE_MS,
  type MarketBuildPhase,
  type WorkerExitReason,
} from "../../../../lib/markets/marketBuildEngine.ts";
import { getCatalogBootstrapState } from "../catalog/catalogBootstrap.ts";
import { registerEventsMetro, syncEventsCatalogForMetro } from "../localEvents/eventsCatalogSync.ts";
import {
  ACTIVITY_CATEGORIES,
  registerActivitiesMetro,
  syncActivitiesCatalogForMetro,
} from "../places/activitiesCatalogSync.ts";
import {
  registerFoodDrinkMetro,
  syncFoodDrinkCatalogForMetro,
} from "../places/foodDrinkCatalogSync.ts";
import {
  reconcileCatalogBootstrap,
  reconcileCatalogBootstrapLegacy,
} from "./bootstrapReconcile.ts";
import {
  assessUsMarketCompleteness,
  isMarketSupported,
  marketStatusFromCompleteness,
  validateUsMarketOnly,
  type MarketCompletenessReport,
  type UsMarketRow,
} from "./marketCompleteness.ts";
import {
  completePhaseCheckpoint,
  failPhaseCheckpoint,
  getPhaseCheckpoint,
  isPhaseComplete,
  listCompletedActivityCategories,
  skipPhaseCheckpoint,
  startPhaseCheckpoint,
} from "./marketBuildCheckpoints.ts";
import { assertUsCountryCode, MARKET_BUILD_LOCK_MS } from "./usOnly.ts";

export type MarketBuildPhaseResult =
  | {
      ok: true;
      phase: MarketBuildPhase;
      slug: string;
      metroKey: string;
      runId: string;
      skipped?: boolean;
      durationMs: number;
      rowsImported?: number;
      apiCallCounts?: Record<string, number>;
      completeness?: MarketCompletenessReport;
      status?: string;
      warnings?: string[];
      bootstrapReconcile?: unknown;
    }
  | { ok: false; error: string; code?: string; workerExitReason?: WorkerExitReason };

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

export async function clearStaleMarketLock(
  admin: SupabaseClient,
  market: MarketRow
): Promise<boolean> {
  if (!market.build_lock_token) return false;
  const expires = market.build_lock_expires_at
    ? new Date(market.build_lock_expires_at).getTime()
    : 0;
  if (expires > Date.now() + STALE_LOCK_GRACE_MS) return false;

  await admin
    .from("kindred_us_markets")
    .update({
      build_lock_token: null,
      build_lock_expires_at: null,
      status: market.status === "building" ? "needs_attention" : market.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", market.id);

  return true;
}

async function acquirePhaseLock(
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
      error: "Market build already in progress — retry after the current phase finishes.",
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
    .eq("id", market.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function releasePhaseLock(
  admin: SupabaseClient,
  marketId: string,
  lockToken: string,
  restoreStatus?: string
): Promise<void> {
  const patch: Record<string, unknown> = {
    build_lock_token: null,
    build_lock_expires_at: null,
    updated_at: new Date().toISOString(),
  };
  if (restoreStatus) patch.status = restoreStatus;

  await admin
    .from("kindred_us_markets")
    .update(patch)
    .eq("id", marketId)
    .eq("build_lock_token", lockToken);
}

async function createPhaseBuildLog(
  admin: SupabaseClient,
  market: MarketRow,
  input: {
    runId: string;
    phase: MarketBuildPhase;
    attempt: number;
    checkpoint?: string | null;
  }
): Promise<string> {
  const { data, error } = await admin
    .from("kindred_market_build_logs")
    .insert({
      market_id: market.id,
      slug: market.slug,
      state_code: market.state_code,
      country_code: "US",
      job_type: "build",
      status: "running",
      run_id: input.runId,
      phase: input.phase,
      checkpoint: input.checkpoint ?? null,
      attempt_count: input.attempt,
      retry_count: input.attempt - 1,
      sections_requested: MARKET_BUILD_PHASES,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "Could not create phase build log");
  }
  return data.id as string;
}

async function finalizePhaseBuildLog(
  admin: SupabaseClient,
  logId: string,
  input: {
    startedAt: number;
    status: "succeeded" | "failed" | "partial";
    rowsImported?: number;
    apiCallCounts?: Record<string, number>;
    workerExitReason?: string;
    warnings?: string[];
    errorDetails?: string | null;
    completeness?: MarketCompletenessReport | null;
  }
): Promise<void> {
  await admin
    .from("kindred_market_build_logs")
    .update({
      status: input.status,
      ended_at: new Date().toISOString(),
      duration_ms: Date.now() - input.startedAt,
      rows_imported: input.rowsImported ?? 0,
      api_call_counts: input.apiCallCounts ?? {},
      worker_exit_reason: input.workerExitReason ?? "success",
      warnings: input.warnings ?? [],
      error_details: input.errorDetails ?? null,
      completeness: input.completeness ?? null,
    })
    .eq("id", logId);
}

function phaseCatalog(phase: MarketBuildPhase): string {
  if (phase === "events") return "events";
  if (phase === "activities") return "activities";
  if (phase === "food_drinks") return "food_drinks";
  return "orchestrator";
}

export async function runMarketBuildPhase(
  admin: SupabaseClient,
  input: {
    slug: string;
    phase: MarketBuildPhase;
    runId: string;
    attempt?: number;
    dryRun?: boolean;
  }
): Promise<MarketBuildPhaseResult> {
  const startedAt = Date.now();
  const attempt = input.attempt ?? 1;
  const phase = input.phase;
  const warnings: string[] = [];

  if (attempt > PHASE_MAX_ATTEMPTS) {
    return {
      ok: false,
      error: `Phase ${phase} exceeded max attempts (${PHASE_MAX_ATTEMPTS})`,
      code: "MAX_ATTEMPTS",
    };
  }

  const market = await loadMarket(admin, input.slug);
  if (!market) {
    return { ok: false, error: `Unknown US market slug: ${input.slug}` };
  }

  try {
    assertUsCountryCode(market.country_code, "build market phase");
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

  if (await isPhaseComplete(admin, input.runId, phase)) {
    return {
      ok: true,
      phase,
      slug: market.slug,
      metroKey: market.metro_key,
      runId: input.runId,
      skipped: true,
      durationMs: Date.now() - startedAt,
      warnings: [`Phase ${phase} already completed — skipped`],
    };
  }

  if (input.dryRun) {
    const completeness = await assessUsMarketCompleteness(admin, market);
    return {
      ok: true,
      phase,
      slug: market.slug,
      metroKey: market.metro_key,
      runId: input.runId,
      skipped: true,
      durationMs: Date.now() - startedAt,
      completeness,
      status: market.status,
      warnings: ["dry_run — no writes performed"],
    };
  }

  const lockToken = crypto.randomUUID();
  const lock = await acquirePhaseLock(admin, market, lockToken);
  if (!lock.ok) {
    const cleared = await clearStaleMarketLock(admin, market);
    if (cleared) {
      const reloaded = await loadMarket(admin, input.slug);
      if (reloaded) {
        const retryLock = await acquirePhaseLock(admin, reloaded, lockToken);
        if (!retryLock.ok) {
          return { ok: false, error: retryLock.error, code: "BUILD_IN_PROGRESS" };
        }
      }
    } else {
      return { ok: false, error: lock.error, code: "BUILD_IN_PROGRESS" };
    }
  }

  const checkpointRow = await startPhaseCheckpoint(admin, {
    metroKey: market.metro_key,
    slug: market.slug,
    runId: input.runId,
    catalog: phaseCatalog(phase),
    phase,
    attempt,
  });

  let logId = "";
  const apiCallCounts: Record<string, number> = {};
  let rowsImported = 0;
  let completeness: MarketCompletenessReport | undefined;
  let nextStatus = market.status;

  try {
    logId = await createPhaseBuildLog(admin, market, {
      runId: input.runId,
      phase,
      attempt,
    });

    const loc = locationFromMarket(market);

    switch (phase) {
      case "preflight": {
        await registerEventsMetro(admin, loc);
        await registerActivitiesMetro(admin, loc);
        await registerFoodDrinkMetro(admin, loc);

        const bootstrap = await getCatalogBootstrapState(admin, market.metro_key);
        const { count: storyCount } = await admin
          .from("kindred_city_articles")
          .select("id", { count: "exact", head: true })
          .eq("metro_key", market.metro_key)
          .eq("approval_status", "approved");

        if ((storyCount ?? 0) < 1) {
          throw new Error(
            "Story of Your City requires an approved kindred_city_articles row before build"
          );
        }

        if (market.status === "complete") {
          warnings.push("Market already complete — catalog phases will be skipped by orchestrator");
        }

        completeness = await assessUsMarketCompleteness(admin, market);
        if (bootstrap.eventsCatalogBootstrapped) {
          warnings.push("Events catalog already bootstrapped");
        }
        break;
      }

      case "events": {
        await registerEventsMetro(admin, loc);
        const { data: eventsMetro } = await admin
          .from("events_catalog_metros")
          .select("*")
          .eq("metro_key", market.metro_key)
          .maybeSingle();
        if (!eventsMetro) throw new Error("Events metro not registered");

        const mode = eventsMetro.initial_import_completed_at ? "incremental" : "full";
        const stats = await syncEventsCatalogForMetro(admin, eventsMetro, mode);
        apiCallCounts.eventbrite = stats.apiCalls;
        rowsImported = stats.newDiscovered + stats.changedUpdated;
        break;
      }

      case "activities": {
        await registerActivitiesMetro(admin, loc);
        const { data: activitiesMetro } = await admin
          .from("activities_catalog_metros")
          .select("*")
          .eq("metro_key", market.metro_key)
          .maybeSingle();
        if (!activitiesMetro) throw new Error("Activities metro not registered");

        const completedCategories = await listCompletedActivityCategories(
          admin,
          input.runId,
          market.metro_key
        );
        const skipCategories = completedCategories;

        const mode = activitiesMetro.initial_import_completed_at
          ? "incremental"
          : "full";

        const stats = await syncActivitiesCatalogForMetro(
          admin,
          activitiesMetro,
          mode,
          {
            skipCategories,
            deferEditorialNotes: true,
            onCategoryComplete: async (category, partial) => {
              await admin.from("kindred_market_build_checkpoints").upsert(
                {
                  metro_key: market.metro_key,
                  slug: market.slug,
                  run_id: input.runId,
                  catalog: "activities",
                  phase: "activities",
                  checkpoint: category,
                  status: "completed",
                  rows_imported:
                    (partial.newDiscovered ?? 0) + (partial.changedUpdated ?? 0),
                  api_calls: partial.apiCalls ?? 0,
                  completed_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "run_id,phase,checkpoint" }
              );
            },
          }
        );

        apiCallCounts.foursquare = stats.apiCalls;
        rowsImported = stats.newDiscovered + stats.changedUpdated;
        break;
      }

      case "food_drinks": {
        await registerFoodDrinkMetro(admin, loc);
        const { data: foodMetro } = await admin
          .from("food_drink_catalog_metros")
          .select("*")
          .eq("metro_key", market.metro_key)
          .maybeSingle();
        if (!foodMetro) throw new Error("Food metro not registered");

        const mode = foodMetro.initial_import_completed_at ? "incremental" : "full";
        const stats = await syncFoodDrinkCatalogForMetro(admin, foodMetro, mode, {
          deferEditorialNotes: true,
        });
        apiCallCounts.foursquare = (apiCallCounts.foursquare ?? 0) + stats.apiCalls;
        rowsImported = stats.newDiscovered + stats.changedUpdated;
        break;
      }

      case "reconcile": {
        const results = await reconcileCatalogBootstrap(
          admin,
          market.metro_key,
          input.runId
        );
        const legacy = await reconcileCatalogBootstrapLegacy(admin, market.metro_key);
        completeness = await assessUsMarketCompleteness(admin, market);
        await finalizePhaseBuildLog(admin, logId, {
          startedAt,
          status: "succeeded",
          rowsImported: 0,
          workerExitReason: "success",
          warnings,
          completeness,
        });
        await completePhaseCheckpoint(admin, checkpointRow.id, {
          workerExitReason: "success",
          metadata: { reconcile: results, legacy },
        });
        await releasePhaseLock(admin, market.id, lockToken, market.status);
        return {
          ok: true,
          phase,
          slug: market.slug,
          metroKey: market.metro_key,
          runId: input.runId,
          durationMs: Date.now() - startedAt,
          bootstrapReconcile: { results, legacy },
          completeness,
          warnings,
        };
      }

      case "validate": {
        completeness = await validateUsMarketOnly(admin, market);
        nextStatus = marketStatusFromCompleteness(completeness, market.status);
        await admin
          .from("kindred_us_markets")
          .update({
            status: nextStatus,
            is_supported: isMarketSupported(completeness),
            completeness,
            updated_at: new Date().toISOString(),
          })
          .eq("id", market.id);
        break;
      }

      case "finalize": {
        completeness = await assessUsMarketCompleteness(admin, market);
        nextStatus = marketStatusFromCompleteness(completeness, market.status);
        await admin
          .from("kindred_us_markets")
          .update({
            status: nextStatus,
            is_supported: isMarketSupported(completeness),
            completeness,
            last_built_at: new Date().toISOString(),
            last_success_at: completeness.complete
              ? new Date().toISOString()
              : null,
            last_build_duration_ms: Date.now() - startedAt,
            last_error: completeness.complete
              ? null
              : completeness.deficiencies.join("; "),
            updated_at: new Date().toISOString(),
          })
          .eq("id", market.id);
        break;
      }

      default:
        throw new Error(`Unknown phase: ${phase satisfies never}`);
    }

    if (phase !== "reconcile") {
      completeness = completeness ?? (await assessUsMarketCompleteness(admin, market));
    }

    await finalizePhaseBuildLog(admin, logId, {
      startedAt,
      status: "succeeded",
      rowsImported,
      apiCallCounts,
      workerExitReason: "success",
      warnings,
      completeness: completeness ?? null,
    });

    await completePhaseCheckpoint(admin, checkpointRow.id, {
      rowsImported,
      apiCalls: Object.values(apiCallCounts).reduce((a, b) => a + b, 0),
      workerExitReason: "success",
    });

    const restoreStatus =
      phase === "validate" || phase === "finalize" ? nextStatus : "needs_attention";

    await releasePhaseLock(
      admin,
      market.id,
      lockToken,
      phase === "preflight" ? market.status : restoreStatus === "building" ? "needs_attention" : restoreStatus
    );

    return {
      ok: true,
      phase,
      slug: market.slug,
      metroKey: market.metro_key,
      runId: input.runId,
      durationMs: Date.now() - startedAt,
      rowsImported,
      apiCallCounts,
      completeness,
      status: nextStatus,
      warnings,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    completeness = await assessUsMarketCompleteness(admin, market).catch(() => undefined);

    await failPhaseCheckpoint(admin, checkpointRow.id, {
      workerExitReason: "error",
      lastError: message,
      rowsImported,
      apiCalls: Object.values(apiCallCounts).reduce((a, b) => a + b, 0),
    });

    if (logId) {
      await finalizePhaseBuildLog(admin, logId, {
        startedAt,
        status: "failed",
        rowsImported,
        apiCallCounts,
        workerExitReason: "error",
        errorDetails: message,
        completeness: completeness ?? null,
        warnings,
      });
    }

    await admin
      .from("kindred_us_markets")
      .update({
        status: "needs_attention",
        last_failure_at: new Date().toISOString(),
        last_error: message,
        completeness: completeness ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", market.id);

    await releasePhaseLock(admin, market.id, lockToken);

    return { ok: false, error: message, code: "PHASE_FAILED", workerExitReason: "error" };
  }
}

export { ACTIVITY_CATEGORIES, MARKET_BUILD_PHASES };
