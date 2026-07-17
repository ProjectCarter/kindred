/**
 * Food & Drink catalog sync — full reconciliation + daily incremental discovery.
 * Server-side only; never called from client or per-user edition reads.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { GUIDE_ELIGIBLE_LIFECYCLES, lifecycleAfterMissingFromSync } from "../editorial/venueLifecycle.ts";
import { writeEditorialNotesForPlaces } from "./notes.ts";
import {
  catalogContentFingerprint,
  estimatedCostPerApiCall,
  findCatalogDuplicate,
  normalizeCatalogName,
  verifyFoodDrinkPlace,
  type FoodDrinkCatalogRow,
} from "./foodDrinkCatalog.ts";
import { mergeProviderImport } from "./venueImporter.ts";
import { scoreVenueEditorialRecord } from "./venueEditorialScoring.ts";
import { searchFoursquareCategory, type CatalogSearchMode } from "./foursquareProvider.ts";
import type { NormalizedPlace, PlacesCategory, PlacesLocation } from "./types.ts";

const FOOD_CATEGORIES: PlacesCategory[] = ["coffee", "restaurants", "bakeries"];

async function applyVenueEditorialScore(
  admin: SupabaseClient,
  venueId: string,
  row: Partial<FoodDrinkCatalogRow> & {
    name: string;
    lifecycle: FoodDrinkCatalogRow["lifecycle"];
    verification_status: string;
    confidence_score: number;
  },
  place: NormalizedPlace,
  now: string,
  options?: { force?: boolean; previousFingerprint?: string | null }
): Promise<void> {
  const { patch } = scoreVenueEditorialRecord({
    row,
    place,
    now,
    previousFingerprint: options?.previousFingerprint ?? null,
    force: options?.force,
  });
  if (!patch) return;
  await admin.from("food_drink_catalog").update(patch).eq("id", venueId);
}

async function upsertProviderLink(
  admin: SupabaseClient,
  venueId: string,
  metroKey: string,
  place: NormalizedPlace,
  observedAt: string
): Promise<void> {
  await admin.from("kindred_venue_provider_links").upsert(
    {
      venue_id: venueId,
      metro_key: metroKey,
      provider: "foursquare",
      provider_id: place.providerId,
      provider_category: place.category,
      last_seen_at: observedAt,
    },
    { onConflict: "metro_key,provider,provider_id" }
  );
}

function mergedRowToDbPatch(
  merged: ReturnType<typeof mergeProviderImport>,
  place: NormalizedPlace,
  now: string
): Record<string, unknown> {
  return {
    name: merged.name,
    normalized_name: merged.normalized_name,
    address: merged.address,
    city: merged.city,
    state: merged.state,
    lat: merged.lat,
    lon: merged.lon,
    url: merged.url,
    phone: merged.phone,
    cuisine: merged.cuisine,
    price_level: merged.price_level,
    editorial_categories: merged.editorial_categories,
    provider_categories: place.providerCategories ?? [],
    content_fingerprint: merged.content_fingerprint,
    field_sources: merged.field_sources,
    source_history: merged.source_history,
    confidence_score: merged.confidence_score,
    lifecycle: merged.lifecycle,
    verification_status: merged.verification_status,
    status: merged.status,
    last_verified_at: now,
    updated_at: now,
  };
}

export type FoodDrinkMetroRow = {
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

export type FoodDrinkSyncRunStats = {
  metroKey: string;
  mode: CatalogSearchMode;
  apiCalls: number;
  rawPlacesReturned: number;
  existingSkipped: number;
  newDiscovered: number;
  changedUpdated: number;
  duplicatesMerged: number;
  placesRejected: number;
  editorialQueued: number;
  estimatedCostUsd: number;
  possiblyClosed: number;
};

export function metroKeyFromLocation(location: PlacesLocation): string {
  const state = location.state?.trim() || location.region?.trim() || "";
  const raw = `${location.city.trim()}-${state}`.toLowerCase();
  return raw
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function registerFoodDrinkMetro(
  admin: SupabaseClient,
  location: PlacesLocation
): Promise<void> {
  const metroKey = metroKeyFromLocation(location);
  await admin.from("food_drink_catalog_metros").upsert(
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

export async function loadFoodDrinkCatalogPlaces(
  admin: SupabaseClient,
  metroKey: string,
  category: PlacesCategory
): Promise<NormalizedPlace[]> {
  const { data, error } = await admin
    .from("food_drink_catalog")
    .select("*")
    .eq("metro_key", metroKey)
    .eq("provider_category", category)
    .in("lifecycle", [...GUIDE_ELIGIBLE_LIFECYCLES])
    .order("name", { ascending: true });

  if (error || !data) {
    console.error("[foodDrink:catalog] read failure", { metroKey, category, error });
    return [];
  }

  return (data as FoodDrinkCatalogRow[]).map((row) => ({
    providerId: row.provider_id,
    name: row.name,
    category: row.provider_category as PlacesCategory,
    address: row.address,
    city: row.city,
    state: row.state,
    lat: row.lat,
    lon: row.lon,
    url: row.url,
    providerCategories: row.provider_categories ?? [],
    rating: null,
    priceTier: row.price_level,
    editorialScore: row.editorial_score,
    editorialLabels: (row.editorial_labels ?? []) as string[],
    kindredVenueId: row.id,
    note: row.editorial_teaser ?? row.note,
  }));
}

export async function syncFoodDrinkCatalogForMetro(
  admin: SupabaseClient,
  metro: FoodDrinkMetroRow,
  mode: CatalogSearchMode
): Promise<FoodDrinkSyncRunStats> {
  const now = new Date().toISOString();
  const stats: FoodDrinkSyncRunStats = {
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
    possiblyClosed: 0,
  };

  const { data: runRow } = await admin
    .from("food_drink_catalog_sync_runs")
    .insert({
      metro_key: metro.metro_key,
      mode,
      started_at: now,
    })
    .select("id")
    .single();

  const runId = runRow?.id as string | undefined;

  const { data: existingRows } = await admin
    .from("food_drink_catalog")
    .select("*")
    .eq("metro_key", metro.metro_key);

  const existing = (existingRows ?? []) as FoodDrinkCatalogRow[];
  const existingByProviderId = new Map(
    existing.map((row) => [row.provider_id, row])
  );
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

  for (const category of FOOD_CATEGORIES) {
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

    stats.apiCalls += searchStats.apiCalls;
    stats.rawPlacesReturned += searchStats.rawResultCount;

    for (const place of fetched) {
      seenProviderIds.add(place.providerId);

      const verification = verifyFoodDrinkPlace(place, metro);
      if (!verification.ok) {
        stats.placesRejected += 1;
        const priorRejected = existingByProviderId.get(place.providerId);
        if (priorRejected?.status === "rejected") {
          stats.existingSkipped += 1;
          await admin
            .from("food_drink_catalog")
            .update({ last_verified_at: now, updated_at: now })
            .eq("id", priorRejected.id);
        } else if (!priorRejected) {
          await admin.from("food_drink_catalog").insert({
            metro_key: metro.metro_key,
            provider: "foursquare",
            provider_id: place.providerId,
            provider_category: place.category,
            name: place.name.trim(),
            normalized_name: normalizeCatalogName(place.name),
            address: place.address,
            city: place.city,
            state: place.state,
            lat: place.lat,
            lon: place.lon,
            url: place.url,
            provider_categories: place.providerCategories ?? [],
            note: null,
            editorial_teaser: null,
            editorial_article: null,
            editorial_categories: [],
            editorial_tags: [],
            opening_hours: null,
            photos: [],
            phone: null,
            cuisine: null,
            price_level: place.priceTier,
            content_fingerprint: catalogContentFingerprint(place),
            status: "rejected",
            lifecycle: "rejected",
            verification_status: "rejected",
            confidence_score: 0,
            field_sources: {},
            source_history: [],
            rejection_reason: verification.reason,
            first_seen_at: now,
            last_verified_at: now,
            discovered_at: null,
            editorial_note_at: null,
          });
          knownProviderIds.add(place.providerId);
        }
        continue;
      }

      const duplicate = findCatalogDuplicate(place, existing);
      if (duplicate) {
        stats.duplicatesMerged += 1;
        knownProviderIds.add(place.providerId);
        await upsertProviderLink(admin, duplicate.id, metro.metro_key, place, now);
        await admin
          .from("food_drink_catalog")
          .update({
            last_verified_at: now,
            updated_at: now,
          })
          .eq("id", duplicate.id);
        continue;
      }

      const prior = existingByProviderId.get(place.providerId);
      const merged = mergeProviderImport({
        place,
        existingFieldSources: prior?.field_sources,
        existingHistory: prior?.source_history,
        currentLifecycle: prior?.lifecycle ?? "new",
        ctx: {
          source: "foursquare",
          observedAt: now,
          passesVerification: true,
          isNewDiscovery: !prior,
          missingFromFullSync: false,
        },
      });

      if (prior) {
        if (
          !merged.materialChanged &&
          prior.content_fingerprint === merged.content_fingerprint &&
          prior.lifecycle === merged.lifecycle
        ) {
          stats.existingSkipped += 1;
          await upsertProviderLink(admin, prior.id, metro.metro_key, place, now);
          await admin
            .from("food_drink_catalog")
            .update({ last_verified_at: now, updated_at: now })
            .eq("id", prior.id);
          continue;
        }

        stats.changedUpdated += 1;
        await admin
          .from("food_drink_catalog")
          .update(mergedRowToDbPatch(merged, place, now))
          .eq("id", prior.id);
        await upsertProviderLink(admin, prior.id, metro.metro_key, place, now);
        await applyVenueEditorialScore(
          admin,
          prior.id,
          {
            ...prior,
            ...merged,
            verification_status: merged.verification_status,
            confidence_score: merged.confidence_score,
          },
          place,
          now,
          {
            previousFingerprint: prior.editorial_score_material_fingerprint,
            force: merged.materialChanged,
          }
        );

        if (merged.materialChanged) needsEditorialNote.push(place);
        continue;
      }

      stats.newDiscovered += 1;
      const { data: inserted } = await admin
        .from("food_drink_catalog")
        .insert({
          metro_key: metro.metro_key,
          provider: "foursquare",
          provider_id: place.providerId,
          provider_category: place.category,
          ...mergedRowToDbPatch(merged, place, now),
          first_seen_at: now,
          discovered_at: now,
          editorial_note_at: null,
          rejection_reason: null,
        })
        .select("id")
        .single();

      if (inserted) {
        const venueId = inserted.id as string;
        const row: FoodDrinkCatalogRow = {
          id: venueId,
          metro_key: metro.metro_key,
          provider: "foursquare",
          provider_id: place.providerId,
          provider_category: place.category,
          duplicate_of: null,
          editorial_tags: [],
          editorial_article: null,
          opening_hours: null,
          photos: [],
          note: null,
          editorial_teaser: null,
          discovered_at: now,
          editorial_note_at: null,
          rejection_reason: null,
          provider_categories: place.providerCategories ?? [],
          ...merged,
        } as FoodDrinkCatalogRow;

        existingByProviderId.set(place.providerId, row);
        knownProviderIds.add(place.providerId);
        existing.push(row);
        await upsertProviderLink(admin, venueId, metro.metro_key, place, now);
        await applyVenueEditorialScore(
          admin,
          venueId,
          {
            ...row,
            verification_status: merged.verification_status,
            confidence_score: merged.confidence_score,
          },
          place,
          now,
          { force: true }
        );
        needsEditorialNote.push(place);
      }
    }
  }

  if (mode === "full") {
    for (const row of existing) {
      if (row.lifecycle === "rejected" || row.lifecycle === "duplicate" || row.lifecycle === "closed") {
        continue;
      }
      if (seenProviderIds.has(row.provider_id)) continue;
      stats.possiblyClosed += 1;
      const nextLifecycle = lifecycleAfterMissingFromSync(row.lifecycle);
      await admin
        .from("food_drink_catalog")
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
          .from("food_drink_catalog")
          .update({
            note: noted.note ?? null,
            editorial_teaser: noted.note ?? null,
            editorial_note_at: now,
            updated_at: now,
          })
          .eq("metro_key", metro.metro_key)
          .eq("provider_id", noted.providerId);
      }
    }
  }

  stats.estimatedCostUsd = stats.apiCalls * estimatedCostPerApiCall();

  const metroPatch: Record<string, string> = { updated_at: now };
  if (mode === "full" || !metro.initial_import_completed_at) {
    metroPatch.initial_import_completed_at = now;
    metroPatch.last_full_sync_at = now;
  }
  metroPatch.last_incremental_sync_at = now;

  await admin
    .from("food_drink_catalog_metros")
    .update(metroPatch)
    .eq("metro_key", metro.metro_key);

  if (runId) {
    await admin
      .from("food_drink_catalog_sync_runs")
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
        diagnostics: { possiblyClosed: stats.possiblyClosed },
      })
      .eq("id", runId);
  }

  console.log("[foodDrink:catalog] sync complete", stats);
  return stats;
}

export async function listFoodDrinkMetrosForSync(
  admin: SupabaseClient,
  options?: { metroKey?: string | null }
): Promise<FoodDrinkMetroRow[]> {
  let query = admin.from("food_drink_catalog_metros").select("*");
  if (options?.metroKey) {
    query = query.eq("metro_key", options.metroKey);
  }
  const { data, error } = await query;
  if (error) {
    console.error("[foodDrink:catalog] metro list failure", error);
    return [];
  }
  return (data ?? []) as FoodDrinkMetroRow[];
}
