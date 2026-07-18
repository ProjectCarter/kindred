/**
 * Activities catalog sync — full reconciliation + daily incremental discovery.
 * Server-side only; never called from client or per-user edition reads.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  createBudgetTracker,
  estimateProviderCallCost,
  isProviderDisabled,
  loadCatalogSyncBudget,
  nextScheduledRunAt,
  recordApiCalls,
  type CatalogSyncMode,
} from "../editorial/catalogSyncBudget.ts";
import { ACTIVITY_CATEGORY_CONCURRENCY } from "../../../../lib/markets/marketBuildEngine.ts";
import {
  batchTouchByIds,
  batchUpsertRows,
  queueEditorialNotes,
} from "../markets/batchCatalogWrites.ts";
import {
  activityContentFingerprint,
  activityExperienceFingerprint,
  activityLifecycleAfterMissingFromSync,
  findActivityCatalogDuplicate,
  normalizeActivityName,
  resolveActivityLifecycleAfterImport,
  rowToNormalizedPlace,
  verifyActivityPlace,
  type ActivitiesCatalogRow,
} from "./activitiesCatalog.ts";
import { searchFoursquareCategory, type CatalogSearchMode } from "./foursquareProvider.ts";
import { metroKeyFromLocation } from "./foodDrinkCatalogSync.ts";
import type { NormalizedPlace, PlacesCategory, PlacesLocation } from "./types.ts";

/** Keep in sync with ACTIVITY_PLACES_CATEGORIES in places/index.ts */
export const ACTIVITY_CATEGORIES: PlacesCategory[] = [
  "water_recreation",
  "escape_rooms",
  "bowling",
  "mini_golf",
  "rock_climbing",
  "axe_throwing",
  "go_karts",
  "pickleball",
  "arcades",
  "laser_tag",
  "paintball",
  "billiards",
  "roller_skating",
  "ice_skating",
  "karaoke",
  "batting_cages",
  "parks",
  "museums",
  "scenic_drives",
  "gardens",
  "beaches",
  "attractions",
];

export type ActivitiesMetroRow = {
  metro_key: string;
  city: string;
  region: string | null;
  state: string | null;
  lat: number;
  lon: number;
  initial_import_completed_at: string | null;
  last_full_sync_at: string | null;
  last_incremental_sync_at: string | null;
};

export type ActivitiesSyncRunStats = {
  metroKey: string;
  mode: CatalogSyncMode;
  apiCalls: number;
  rawPlacesReturned: number;
  existingSkipped: number;
  newDiscovered: number;
  changedUpdated: number;
  duplicatesMerged: number;
  placesRejected: number;
  editorialQueued: number;
  estimatedCostUsd: number;
  possiblyInactive: number;
};

export type SyncActivitiesOptions = {
  skipCategories?: Set<string>;
  deferEditorialNotes?: boolean;
  categoryConcurrency?: number;
  onCategoryComplete?: (
    category: PlacesCategory,
    partial: Pick<
      ActivitiesSyncRunStats,
      "apiCalls" | "rawPlacesReturned" | "newDiscovered" | "changedUpdated"
    >
  ) => Promise<void>;
};

export { metroKeyFromLocation as activitiesMetroKeyFromLocation };

export async function registerActivitiesMetro(
  admin: SupabaseClient,
  location: PlacesLocation
): Promise<void> {
  const metroKey = metroKeyFromLocation(location);
  await admin.from("activities_catalog_metros").upsert(
    {
      metro_key: metroKey,
      city: location.city,
      region: location.region ?? null,
      state: location.state ?? null,
      lat: location.lat,
      lon: location.lon,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "metro_key" }
  );
}

export async function loadActivitiesCatalogPlaces(
  admin: SupabaseClient,
  metroKey: string,
  category: PlacesCategory
): Promise<NormalizedPlace[]> {
  const { data, error } = await admin
    .from("activities_catalog")
    .select("*")
    .eq("metro_key", metroKey)
    .eq("provider_category", category)
    .in("lifecycle", ["verified", "active", "featured"])
    .order("name", { ascending: true });

  if (error || !data) {
    console.error("[activities:catalog] read failure", { metroKey, category, error });
    return [];
  }

  return (data as ActivitiesCatalogRow[]).map(rowToNormalizedPlace);
}

async function processActivityCategory(
  admin: SupabaseClient,
  input: {
    category: PlacesCategory;
    metro: ActivitiesMetroRow;
    mode: CatalogSyncMode;
    now: string;
    location: PlacesLocation;
    existing: ActivitiesCatalogRow[];
    existingByProviderId: Map<string, ActivitiesCatalogRow>;
    knownProviderIds: Set<string>;
    seenProviderIds: Set<string>;
    deferEditorialNotes: boolean;
    budgetTracker: ReturnType<typeof createBudgetTracker>;
    budget: ReturnType<typeof loadCatalogSyncBudget>;
  }
): Promise<{
  stats: Pick<
    ActivitiesSyncRunStats,
    | "apiCalls"
    | "rawPlacesReturned"
    | "existingSkipped"
    | "newDiscovered"
    | "changedUpdated"
    | "duplicatesMerged"
    | "placesRejected"
    | "editorialQueued"
  >;
  noteQueue: Array<{ providerId: string; category: string }>;
}> {
  const stats = {
    apiCalls: 0,
    rawPlacesReturned: 0,
    existingSkipped: 0,
    newDiscovered: 0,
    changedUpdated: 0,
    duplicatesMerged: 0,
    placesRejected: 0,
    editorialQueued: 0,
  };
  const noteQueue: Array<{ providerId: string; category: string }> = [];
  const toUpsert: Record<string, unknown>[] = [];
  const touchIds: string[] = [];
  const duplicateTouchIds: string[] = [];

  const searchMode: CatalogSearchMode =
    input.mode === "full" || !input.metro.initial_import_completed_at
      ? "full"
      : "incremental";

  const { places: fetched, stats: searchStats } = await searchFoursquareCategory(
    input.category,
    input.location,
    {
      mode: searchMode,
      knownProviderIds: new Set(input.knownProviderIds),
      withCategoryIds: true,
    }
  );

  if (
    !recordApiCalls(
      input.budgetTracker,
      input.budget,
      searchStats.apiCalls,
      input.category
    )
  ) {
    return { stats, noteQueue };
  }

  stats.apiCalls += searchStats.apiCalls;
  stats.rawPlacesReturned += searchStats.rawResultCount;

  for (const place of fetched) {
    input.seenProviderIds.add(place.providerId);

    const verification = verifyActivityPlace(place, input.metro);
    if (!verification.ok) {
      stats.placesRejected += 1;
      continue;
    }

    const duplicate = findActivityCatalogDuplicate(place, input.existing);
    if (duplicate && duplicate.provider_id !== place.providerId) {
      stats.duplicatesMerged += 1;
      duplicateTouchIds.push(duplicate.id);
      continue;
    }

    const prior = input.existingByProviderId.get(place.providerId);
    const fingerprint = activityContentFingerprint(place);
    const lifecycle = resolveActivityLifecycleAfterImport({
      current: prior?.lifecycle ?? "discovered",
      confidence: verification.confidence,
      passesVerification: true,
      isNewDiscovery: !prior,
      missingFromFullSync: false,
    });

    const patch = {
      name: place.name,
      normalized_name: normalizeActivityName(place.name),
      address: place.address,
      city: place.city,
      state: place.state,
      lat: place.lat,
      lon: place.lon,
      url: place.url,
      provider_categories: place.providerCategories ?? [],
      experience_fingerprint: activityExperienceFingerprint(place),
      content_fingerprint: fingerprint,
      lifecycle,
      verification_status: "verified",
      confidence_score: verification.confidence,
      status: "active",
      last_verified_at: input.now,
      updated_at: input.now,
    };

    if (prior) {
      if (prior.content_fingerprint === fingerprint && prior.lifecycle === lifecycle) {
        stats.existingSkipped += 1;
        touchIds.push(prior.id);
        continue;
      }

      stats.changedUpdated += 1;
      toUpsert.push({
        id: prior.id,
        metro_key: input.metro.metro_key,
        provider: "foursquare",
        provider_id: place.providerId,
        provider_category: place.category,
        ...patch,
        last_material_change_at: input.now,
        editorial_note_pending: input.deferEditorialNotes,
      });
      noteQueue.push({ providerId: place.providerId, category: place.category });
      continue;
    }

    stats.newDiscovered += 1;
    toUpsert.push({
      metro_key: input.metro.metro_key,
      provider: "foursquare",
      provider_id: place.providerId,
      provider_category: place.category,
      ...patch,
      first_seen_at: input.now,
      last_material_change_at: input.now,
      note: null,
      editorial_teaser: null,
      editorial_article: null,
      field_sources: {},
      source_history: [],
      rejection_reason: null,
      editorial_note_pending: input.deferEditorialNotes,
    });
    noteQueue.push({ providerId: place.providerId, category: place.category });
    input.knownProviderIds.add(place.providerId);
  }

  await batchTouchByIds(admin, "activities_catalog", touchIds, {
    last_verified_at: input.now,
    updated_at: input.now,
  });
  await batchTouchByIds(admin, "activities_catalog", duplicateTouchIds, {
    last_verified_at: input.now,
    updated_at: input.now,
  });
  await batchUpsertRows(
    admin,
    "activities_catalog",
    toUpsert,
    "metro_key,provider,provider_id"
  );

  for (const row of toUpsert) {
    const providerId = String(row.provider_id);
    if (!input.existingByProviderId.has(providerId)) {
      input.existingByProviderId.set(providerId, row as ActivitiesCatalogRow);
      input.existing.push(row as ActivitiesCatalogRow);
    }
  }

  stats.editorialQueued = noteQueue.length;
  return { stats, noteQueue };
}

export async function syncActivitiesCatalogForMetro(
  admin: SupabaseClient,
  metro: ActivitiesMetroRow,
  mode: CatalogSyncMode,
  options: SyncActivitiesOptions = {}
): Promise<ActivitiesSyncRunStats> {
  const started = Date.now();
  const now = new Date().toISOString();
  const budgetTracker = createBudgetTracker();
  const budget = loadCatalogSyncBudget("foursquare");
  const deferEditorialNotes = options.deferEditorialNotes ?? true;
  const concurrency = options.categoryConcurrency ?? ACTIVITY_CATEGORY_CONCURRENCY;
  const skipCategories = options.skipCategories ?? new Set<string>();

  const stats: ActivitiesSyncRunStats = {
    metroKey: metro.metro_key,
    mode,
    apiCalls: 0,
    rawPlacesReturned: 0,
    existingSkipped: 0,
    newDiscovered: 0,
    changedUpdated: 0,
    duplicatesMerged: 0,
    placesRejected: 0,
    editorialQueued: 0,
    estimatedCostUsd: 0,
    possiblyInactive: 0,
  };

  if (isProviderDisabled("foursquare")) {
    console.warn("[activities:catalog] foursquare disabled — serving last saved catalog");
    return stats;
  }

  const { data: runRow } = await admin
    .from("activities_catalog_sync_runs")
    .insert({ metro_key: metro.metro_key, mode, started_at: now })
    .select("id")
    .single();

  const runId = runRow?.id as string | undefined;

  const { data: existingRows } = await admin
    .from("activities_catalog")
    .select("*")
    .eq("metro_key", metro.metro_key);

  const existing = (existingRows ?? []) as ActivitiesCatalogRow[];
  const existingByProviderId = new Map(existing.map((row) => [row.provider_id, row]));
  const knownProviderIds = new Set(existing.map((row) => row.provider_id));

  const location: PlacesLocation = {
    lat: metro.lat,
    lon: metro.lon,
    city: metro.city,
    region: metro.region,
    state: metro.state,
  };

  const seenProviderIds = new Set<string>();
  const allNoteQueue: Array<{ providerId: string; category: string }> = [];

  const categories = ACTIVITY_CATEGORIES.filter((c) => !skipCategories.has(c));

  try {
    for (let i = 0; i < categories.length; i += concurrency) {
      if (budgetTracker.aborted) break;
      const batch = categories.slice(i, i + concurrency);

      const results = await Promise.all(
        batch.map((category) =>
          processActivityCategory(admin, {
            category,
            metro,
            mode,
            now,
            location,
            existing,
            existingByProviderId,
            knownProviderIds,
            seenProviderIds,
            deferEditorialNotes,
            budgetTracker,
            budget,
          })
        )
      );

      for (let j = 0; j < batch.length; j++) {
        const category = batch[j]!;
        const { stats: partial, noteQueue } = results[j]!;
        stats.apiCalls += partial.apiCalls;
        stats.rawPlacesReturned += partial.rawPlacesReturned;
        stats.existingSkipped += partial.existingSkipped;
        stats.newDiscovered += partial.newDiscovered;
        stats.changedUpdated += partial.changedUpdated;
        stats.duplicatesMerged += partial.duplicatesMerged;
        stats.placesRejected += partial.placesRejected;
        stats.editorialQueued += partial.editorialQueued;
        allNoteQueue.push(...noteQueue);

        if (options.onCategoryComplete) {
          await options.onCategoryComplete(category, partial);
        }
      }
    }

    if (mode === "full") {
      const inactiveIds: string[] = [];
      for (const row of existing) {
        if (
          row.lifecycle === "rejected" ||
          row.lifecycle === "duplicate" ||
          row.lifecycle === "inactive" ||
          row.lifecycle === "archived"
        ) {
          continue;
        }
        if (seenProviderIds.has(row.provider_id)) continue;
        stats.possiblyInactive += 1;
        inactiveIds.push(row.id);
      }
      const nextLifecyclePatch = {
        lifecycle: activityLifecycleAfterMissingFromSync("active"),
        verification_status: "needs_review",
        status: "possibly_closed",
        updated_at: now,
      };
      for (const row of existing) {
        if (!inactiveIds.includes(row.id)) continue;
        await admin
          .from("activities_catalog")
          .update({
            ...nextLifecyclePatch,
            lifecycle: activityLifecycleAfterMissingFromSync(row.lifecycle),
          })
          .eq("id", row.id);
      }
    }

    if (deferEditorialNotes && allNoteQueue.length) {
      await queueEditorialNotes(admin, {
        metroKey: metro.metro_key,
        catalog: "activities",
        city: metro.city,
        places: allNoteQueue,
      });
    }

    stats.estimatedCostUsd = stats.apiCalls * estimateProviderCallCost("foursquare");

    const metroPatch: Record<string, string> = { updated_at: now };
    if (mode === "full" || !metro.initial_import_completed_at) {
      metroPatch.initial_import_completed_at = now;
      metroPatch.last_full_sync_at = now;
    }
    metroPatch.last_incremental_sync_at = now;

    await admin
      .from("activities_catalog_metros")
      .update(metroPatch)
      .eq("metro_key", metro.metro_key);

    if (runId) {
      await admin
        .from("activities_catalog_sync_runs")
        .update({
          completed_at: new Date().toISOString(),
          api_calls: stats.apiCalls,
          raw_places_returned: stats.rawPlacesReturned,
          existing_skipped: stats.existingSkipped,
          new_discovered: stats.newDiscovered,
          changed_updated: stats.changedUpdated,
          duplicates_merged: stats.duplicatesMerged,
          places_rejected: stats.placesRejected,
          editorial_queued: stats.editorialQueued,
          estimated_cost_usd: stats.estimatedCostUsd,
          run_duration_ms: Date.now() - started,
          next_scheduled_at: nextScheduledRunAt(mode, "activities"),
          diagnostics: {
            budgetAborted: budgetTracker.aborted,
            budgetAbortReason: budgetTracker.abortReason,
            deferEditorialNotes,
          },
        })
        .eq("id", runId);
    }
  } catch (err) {
    console.error("[activities:catalog] sync failure", {
      metroKey: metro.metro_key,
      error: err instanceof Error ? err.message : String(err),
    });
    if (runId) {
      await admin
        .from("activities_catalog_sync_runs")
        .update({
          completed_at: new Date().toISOString(),
          diagnostics: {
            error: err instanceof Error ? err.message : String(err),
          },
        })
        .eq("id", runId);
    }
    throw err;
  }

  return stats;
}

export async function listActivitiesMetrosForSync(
  admin: SupabaseClient,
  options?: { metroKey?: string | null }
): Promise<ActivitiesMetroRow[]> {
  let query = admin.from("activities_catalog_metros").select("*");
  if (options?.metroKey) {
    query = query.eq("metro_key", options.metroKey);
  }
  const { data, error } = await query;
  if (error) {
    console.error("[activities:catalog] metro list failure", error);
    return [];
  }
  return (data ?? []) as ActivitiesMetroRow[];
}
