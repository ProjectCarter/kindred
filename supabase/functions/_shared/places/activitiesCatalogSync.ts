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
import { writeEditorialNotesForPlaces } from "./notes.ts";
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
const ACTIVITY_CATEGORIES: PlacesCategory[] = [
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

export async function syncActivitiesCatalogForMetro(
  admin: SupabaseClient,
  metro: ActivitiesMetroRow,
  mode: CatalogSyncMode
): Promise<ActivitiesSyncRunStats> {
  const started = Date.now();
  const now = new Date().toISOString();
  const budgetTracker = createBudgetTracker();
  const budget = loadCatalogSyncBudget("foursquare");

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
    .insert({
      metro_key: metro.metro_key,
      mode,
      started_at: now,
    })
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
  const needsEditorialNote: NormalizedPlace[] = [];

  try {
    for (const category of ACTIVITY_CATEGORIES) {
      if (budgetTracker.aborted) break;

      const searchMode: CatalogSearchMode =
        mode === "full" || !metro.initial_import_completed_at ? "full" : "incremental";

      const { places: fetched, stats: searchStats } = await searchFoursquareCategory(
        category,
        location,
        {
          mode: searchMode,
          knownProviderIds: new Set(knownProviderIds),
          withCategoryIds: true,
        }
      );

      if (!recordApiCalls(budgetTracker, budget, searchStats.apiCalls, category)) {
        break;
      }

      stats.apiCalls += searchStats.apiCalls;
      stats.rawPlacesReturned += searchStats.rawResultCount;

      for (const place of fetched) {
        seenProviderIds.add(place.providerId);

        const verification = verifyActivityPlace(place, metro);
        if (!verification.ok) {
          stats.placesRejected += 1;
          continue;
        }

        const duplicate = findActivityCatalogDuplicate(place, existing);
        if (duplicate && duplicate.provider_id !== place.providerId) {
          stats.duplicatesMerged += 1;
          await admin
            .from("activities_catalog")
            .update({ last_verified_at: now, updated_at: now })
            .eq("id", duplicate.id);
          continue;
        }

        const prior = existingByProviderId.get(place.providerId);
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
          last_verified_at: now,
          updated_at: now,
        };

        if (prior) {
          if (
            prior.content_fingerprint === fingerprint &&
            prior.lifecycle === lifecycle
          ) {
            stats.existingSkipped += 1;
            await admin
              .from("activities_catalog")
              .update({ last_verified_at: now, updated_at: now })
              .eq("id", prior.id);
            continue;
          }

          stats.changedUpdated += 1;
          await admin
            .from("activities_catalog")
            .update({ ...patch, last_material_change_at: now })
            .eq("id", prior.id);
          needsEditorialNote.push(place);
          continue;
        }

        stats.newDiscovered += 1;
        const { data: inserted } = await admin
          .from("activities_catalog")
          .insert({
            metro_key: metro.metro_key,
            provider: "foursquare",
            provider_id: place.providerId,
            provider_category: place.category,
            ...patch,
            first_seen_at: now,
            last_material_change_at: now,
            note: null,
            editorial_teaser: null,
            editorial_article: null,
            field_sources: {},
            source_history: [],
            rejection_reason: null,
          })
          .select("id")
          .single();

        if (inserted) {
          existingByProviderId.set(place.providerId, {
            id: inserted.id as string,
            metro_key: metro.metro_key,
            provider: "foursquare",
            provider_id: place.providerId,
            provider_category: place.category,
            ...patch,
            phone: null,
            opening_hours: null,
            price_level: place.priceTier,
            note: null,
            editorial_teaser: null,
            editorial_article: null,
            field_sources: {},
            source_history: [],
            rejection_reason: null,
            duplicate_of: null,
            first_seen_at: now,
            last_material_change_at: now,
          } as ActivitiesCatalogRow);
          knownProviderIds.add(place.providerId);
          existing.push(existingByProviderId.get(place.providerId)!);
        }
        needsEditorialNote.push(place);
      }
    }

    if (mode === "full") {
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
        const nextLifecycle = activityLifecycleAfterMissingFromSync(row.lifecycle);
        await admin
          .from("activities_catalog")
          .update({
            lifecycle: nextLifecycle,
            verification_status: "needs_review",
            status: "possibly_closed",
            updated_at: now,
          })
          .eq("id", row.id);
      }
    }

    if (needsEditorialNote.length) {
      stats.editorialQueued = needsEditorialNote.length;
      const byCategory = new Map<PlacesCategory, NormalizedPlace[]>();
      for (const place of needsEditorialNote) {
        const bucket = byCategory.get(place.category) ?? [];
        bucket.push(place);
        byCategory.set(place.category, bucket);
      }

      for (const [category, places] of byCategory) {
        const withNotes = await writeEditorialNotesForPlaces(
          places,
          category,
          metro.city
        );
        for (const noted of withNotes) {
          await admin
            .from("activities_catalog")
            .update({
              note: noted.note ?? null,
              editorial_teaser: noted.note ?? null,
              updated_at: now,
            })
            .eq("metro_key", metro.metro_key)
            .eq("provider_id", noted.providerId);
        }
      }
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
