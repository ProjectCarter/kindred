/**
 * Bootstrap reconciliation — finalize catalog bootstrap flags from verified row counts.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  BOOTSTRAP_MIN_ACTIVITIES,
  BOOTSTRAP_MIN_EVENTS,
  BOOTSTRAP_MIN_FOOD,
  shouldReconcileBootstrap,
  type MarketCatalogDesk,
} from "../../../../lib/markets/marketBuildEngine.ts";
import { getCatalogBootstrapState } from "../catalog/catalogBootstrap.ts";

export type BootstrapReconcileResult = {
  catalog: MarketCatalogDesk;
  rowCount: number;
  wasBootstrapped: boolean;
  reconciled: boolean;
  reason: string | null;
};

async function countCatalogRows(
  admin: SupabaseClient,
  catalog: MarketCatalogDesk,
  metroKey: string
): Promise<number> {
  switch (catalog) {
    case "events": {
      const { count } = await admin
        .from("events_catalog")
        .select("id", { count: "exact", head: true })
        .eq("metro_key", metroKey);
      return count ?? 0;
    }
    case "activities": {
      const { count } = await admin
        .from("activities_catalog")
        .select("id", { count: "exact", head: true })
        .eq("metro_key", metroKey)
        .eq("lifecycle", "active");
      return count ?? 0;
    }
    case "food_drinks": {
      const { count } = await admin
        .from("food_drink_catalog")
        .select("id", { count: "exact", head: true })
        .eq("metro_key", metroKey)
        .eq("status", "active");
      return count ?? 0;
    }
  }
}

async function allActivityCategoriesComplete(
  admin: SupabaseClient,
  runId: string,
  metroKey: string
): Promise<boolean> {
  const { data } = await admin
    .from("kindred_market_build_checkpoints")
    .select("checkpoint, status")
    .eq("run_id", runId)
    .eq("metro_key", metroKey)
    .eq("phase", "activities")
    .neq("checkpoint", "");

  const rows = data ?? [];
  if (!rows.length) return false;
  return rows.every((r) => r.status === "completed" || r.status === "skipped");
}

async function phaseCheckpointComplete(
  admin: SupabaseClient,
  runId: string,
  metroKey: string,
  phase: string
): Promise<boolean> {
  const { data } = await admin
    .from("kindred_market_build_checkpoints")
    .select("status")
    .eq("run_id", runId)
    .eq("metro_key", metroKey)
    .eq("phase", phase)
    .eq("checkpoint", "")
    .maybeSingle();

  return data?.status === "completed";
}

export async function reconcileCatalogBootstrap(
  admin: SupabaseClient,
  metroKey: string,
  runId: string
): Promise<BootstrapReconcileResult[]> {
  const bootstrap = await getCatalogBootstrapState(admin, metroKey);
  const now = new Date().toISOString();
  const results: BootstrapReconcileResult[] = [];

  const catalogs: MarketCatalogDesk[] = ["events", "activities", "food_drinks"];

  for (const catalog of catalogs) {
    const rowCount = await countCatalogRows(admin, catalog, metroKey);
    const wasBootstrapped =
      catalog === "events"
        ? bootstrap.eventsCatalogBootstrapped
        : catalog === "activities"
        ? bootstrap.activitiesCatalogBootstrapped
        : bootstrap.foodDrinkCatalogBootstrapped;

    const phaseComplete = await phaseCheckpointComplete(
      admin,
      runId,
      metroKey,
      catalog === "food_drinks" ? "food_drinks" : catalog
    );
    const categoriesComplete =
      catalog === "activities"
        ? await allActivityCategoriesComplete(admin, runId, metroKey)
        : false;

    const should = shouldReconcileBootstrap({
      catalog,
      rowCount,
      bootstrapComplete: wasBootstrapped,
      phaseCheckpointComplete: phaseComplete,
      allCategoryCheckpointsComplete: categoriesComplete,
    });

    let reconciled = false;
    let reason: string | null = null;

    if (should) {
      const table =
        catalog === "events"
          ? "events_catalog_metros"
          : catalog === "activities"
          ? "activities_catalog_metros"
          : "food_drink_catalog_metros";

      const { error } = await admin
        .from(table)
        .update({
          initial_import_completed_at: now,
          last_full_sync_at: now,
          last_incremental_sync_at: now,
          updated_at: now,
        })
        .eq("metro_key", metroKey)
        .is("initial_import_completed_at", null);

      if (error) {
        reason = error.message;
      } else {
        reconciled = true;
        reason = `row_count=${rowCount}`;
      }
    } else if (!wasBootstrapped) {
      const min =
        catalog === "events"
          ? BOOTSTRAP_MIN_EVENTS
          : catalog === "activities"
          ? BOOTSTRAP_MIN_ACTIVITIES
          : BOOTSTRAP_MIN_FOOD;
      reason = rowCount < min ? `below threshold (${rowCount}/${min})` : "phase incomplete";
    }

    results.push({ catalog, rowCount, wasBootstrapped, reconciled, reason });
  }

  return results;
}

/** Seattle-style recovery when no run checkpoints exist yet. */
export async function reconcileCatalogBootstrapLegacy(
  admin: SupabaseClient,
  metroKey: string
): Promise<BootstrapReconcileResult[]> {
  const bootstrap = await getCatalogBootstrapState(admin, metroKey);
  const now = new Date().toISOString();
  const results: BootstrapReconcileResult[] = [];

  const specs: Array<{
    catalog: MarketCatalogDesk;
    table: string;
    min: number;
    bootstrapped: boolean;
  }> = [
    {
      catalog: "events",
      table: "events_catalog_metros",
      min: BOOTSTRAP_MIN_EVENTS,
      bootstrapped: bootstrap.eventsCatalogBootstrapped,
    },
    {
      catalog: "activities",
      table: "activities_catalog_metros",
      min: BOOTSTRAP_MIN_ACTIVITIES,
      bootstrapped: bootstrap.activitiesCatalogBootstrapped,
    },
    {
      catalog: "food_drinks",
      table: "food_drink_catalog_metros",
      min: BOOTSTRAP_MIN_FOOD,
      bootstrapped: bootstrap.foodDrinkCatalogBootstrapped,
    },
  ];

  for (const spec of specs) {
    const rowCount = await countCatalogRows(admin, spec.catalog, metroKey);
    const should =
      !spec.bootstrapped &&
      rowCount >= spec.min &&
      shouldReconcileBootstrap({
        catalog: spec.catalog,
        rowCount,
        bootstrapComplete: false,
        phaseCheckpointComplete: true,
        allCategoryCheckpointsComplete: spec.catalog === "activities" && rowCount >= spec.min,
      });

    let reconciled = false;
    let reason: string | null = null;

    if (should) {
      const { error } = await admin
        .from(spec.table)
        .update({
          initial_import_completed_at: now,
          last_full_sync_at: now,
          last_incremental_sync_at: now,
          updated_at: now,
        })
        .eq("metro_key", metroKey)
        .is("initial_import_completed_at", null);

      reconciled = !error;
      reason = error?.message ?? `legacy row_count=${rowCount}`;
    } else if (!spec.bootstrapped) {
      reason = rowCount < spec.min ? `below threshold (${rowCount}/${spec.min})` : "not eligible";
    }

    results.push({
      catalog: spec.catalog,
      rowCount,
      wasBootstrapped: spec.bootstrapped,
      reconciled,
      reason,
    });
  }

  return results;
}
