/**
 * Food & Drink catalog sync — full reconciliation + daily incremental discovery.
 * Server-side only; never called from client or per-user edition reads.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { GUIDE_ELIGIBLE_LIFECYCLES, lifecycleAfterMissingFromSync } from "../editorial/venueLifecycle.ts";
import {
  batchTouchByIds,
  batchUpsertRows,
  queueEditorialNotes,
} from "../markets/batchCatalogWrites.ts";
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

export const FOOD_CATEGORIES: PlacesCategory[] = ["coffee", "restaurants", "bakeries"];

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
  now: string,
  deferEditorialNotes: boolean
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
    editorial_note_pending: deferEditorialNotes,
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

export type SyncFoodDrinkOptions = {
  deferEditorialNotes?: boolean;
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
  location: PlacesLocation,
  catalogMetroKey?: string | null
): Promise<void> {
  const metroKey = catalogMetroKey?.trim() || metroKeyFromLocation(location);
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
    about: row.editorial_article ?? null,
  }));
}

async function syncFoodCategory(
  admin: SupabaseClient,
  input: {
    category: PlacesCategory;
    metro: FoodDrinkMetroRow;
    mode: CatalogSearchMode;
    now: string;
    location: PlacesLocation;
    existing: FoodDrinkCatalogRow[];
    existingByProviderId: Map<string, FoodDrinkCatalogRow>;
    knownProviderIds: Set<string>;
    seenProviderIds: Set<string>;
    deferEditorialNotes: boolean;
  }
): Promise<{
  stats: Pick<
    FoodDrinkSyncRunStats,
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
  const rejectedInserts: Record<string, unknown>[] = [];
  const postScore: Array<{
    venueId: string;
    row: FoodDrinkCatalogRow;
    merged: ReturnType<typeof mergeProviderImport>;
    place: NormalizedPlace;
    force: boolean;
  }> = [];

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

  stats.apiCalls += searchStats.apiCalls;
  stats.rawPlacesReturned += searchStats.rawResultCount;

  for (const place of fetched) {
    input.seenProviderIds.add(place.providerId);

    const verification = verifyFoodDrinkPlace(place, input.metro);
    if (!verification.ok) {
      stats.placesRejected += 1;
      const priorRejected = input.existingByProviderId.get(place.providerId);
      if (priorRejected?.status === "rejected") {
        stats.existingSkipped += 1;
        touchIds.push(priorRejected.id);
      } else if (!priorRejected) {
        rejectedInserts.push({
          id: crypto.randomUUID(),
          metro_key: input.metro.metro_key,
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
          content_fingerprint: catalogContentFingerprint(place),
          status: "rejected",
          lifecycle: "rejected",
          verification_status: "rejected",
          confidence_score: 0,
          field_sources: {},
          source_history: [],
          rejection_reason: verification.reason,
          first_seen_at: input.now,
          last_verified_at: input.now,
          editorial_note_pending: false,
        });
        input.knownProviderIds.add(place.providerId);
      }
      continue;
    }

    const duplicate = findCatalogDuplicate(place, input.existing);
    if (duplicate) {
      stats.duplicatesMerged += 1;
      input.knownProviderIds.add(place.providerId);
      touchIds.push(duplicate.id);
      await upsertProviderLink(admin, duplicate.id, input.metro.metro_key, place, input.now);
      continue;
    }

    const prior = input.existingByProviderId.get(place.providerId);
    const merged = mergeProviderImport({
      place,
      existingFieldSources: prior?.field_sources,
      existingHistory: prior?.source_history,
      currentLifecycle: prior?.lifecycle ?? "new",
      ctx: {
        source: "foursquare",
        observedAt: input.now,
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
        touchIds.push(prior.id);
        await upsertProviderLink(admin, prior.id, input.metro.metro_key, place, input.now);
        continue;
      }

      stats.changedUpdated += 1;
      toUpsert.push({
        id: prior.id,
        metro_key: input.metro.metro_key,
        provider: "foursquare",
        provider_id: place.providerId,
        provider_category: place.category,
        ...mergedRowToDbPatch(merged, place, input.now, input.deferEditorialNotes),
        first_seen_at: prior.first_seen_at,
      });
      postScore.push({
        venueId: prior.id,
        row: prior,
        merged,
        place,
        force: merged.materialChanged,
      });
      if (merged.materialChanged) {
        noteQueue.push({ providerId: place.providerId, category: place.category });
      }
      continue;
    }

    stats.newDiscovered += 1;
    const newId = crypto.randomUUID();
    toUpsert.push({
      id: newId,
      metro_key: input.metro.metro_key,
      provider: "foursquare",
      provider_id: place.providerId,
      provider_category: place.category,
      ...mergedRowToDbPatch(merged, place, input.now, input.deferEditorialNotes),
      first_seen_at: input.now,
      discovered_at: input.now,
      editorial_note_at: null,
      rejection_reason: null,
      editorial_tags: [],
      editorial_article: null,
      opening_hours: null,
      photos: [],
      note: null,
      editorial_teaser: null,
    });
    noteQueue.push({ providerId: place.providerId, category: place.category });
    input.knownProviderIds.add(place.providerId);
  }

  await batchTouchByIds(admin, "food_drink_catalog", touchIds, {
    last_verified_at: input.now,
    updated_at: input.now,
  });
  if (rejectedInserts.length) {
    await batchUpsertRows(
      admin,
      "food_drink_catalog",
      rejectedInserts,
      "metro_key,provider,provider_id"
    );
  }
  if (toUpsert.length) {
    await batchUpsertRows(
      admin,
      "food_drink_catalog",
      toUpsert,
      "metro_key,provider,provider_id"
    );
  }

  for (const item of postScore) {
    await applyVenueEditorialScore(
      admin,
      item.venueId,
      {
        ...item.row,
        ...item.merged,
        verification_status: item.merged.verification_status,
        confidence_score: item.merged.confidence_score,
      },
      item.place,
      input.now,
      {
        previousFingerprint: item.row.editorial_score_material_fingerprint,
        force: item.force,
      }
    );
    await upsertProviderLink(admin, item.venueId, input.metro.metro_key, item.place, input.now);
  }

  for (const row of toUpsert) {
    if (row.id) continue;
    const providerId = String(row.provider_id);
    const { data: inserted } = await admin
      .from("food_drink_catalog")
      .select("id")
      .eq("metro_key", input.metro.metro_key)
      .eq("provider_id", providerId)
      .maybeSingle();
    if (inserted?.id) {
      const place = fetched.find((p) => p.providerId === providerId);
      if (place) {
        await upsertProviderLink(
          admin,
          inserted.id as string,
          input.metro.metro_key,
          place,
          input.now
        );
        await applyVenueEditorialScore(
          admin,
          inserted.id as string,
          row as FoodDrinkCatalogRow,
          place,
          input.now,
          { force: true }
        );
      }
    }
  }

  stats.editorialQueued = noteQueue.length;
  return { stats, noteQueue };
}

export async function syncFoodDrinkCatalogForMetro(
  admin: SupabaseClient,
  metro: FoodDrinkMetroRow,
  mode: CatalogSearchMode,
  options: SyncFoodDrinkOptions = {}
): Promise<FoodDrinkSyncRunStats> {
  const now = new Date().toISOString();
  const deferEditorialNotes = options.deferEditorialNotes ?? true;

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
    .insert({ metro_key: metro.metro_key, mode, started_at: now })
    .select("id")
    .single();

  const runId = runRow?.id as string | undefined;

  const { data: existingRows } = await admin
    .from("food_drink_catalog")
    .select("*")
    .eq("metro_key", metro.metro_key);

  const existing = (existingRows ?? []) as FoodDrinkCatalogRow[];
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

  const categoryResults = await Promise.all(
    FOOD_CATEGORIES.map((category) =>
      syncFoodCategory(admin, {
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
      })
    )
  );

  for (const { stats: partial, noteQueue } of categoryResults) {
    stats.apiCalls += partial.apiCalls;
    stats.rawPlacesReturned += partial.rawPlacesReturned;
    stats.existingSkipped += partial.existingSkipped;
    stats.newDiscovered += partial.newDiscovered;
    stats.changedUpdated += partial.changedUpdated;
    stats.duplicatesMerged += partial.duplicatesMerged;
    stats.placesRejected += partial.placesRejected;
    stats.editorialQueued += partial.editorialQueued;
    allNoteQueue.push(...noteQueue);
  }

  if (mode === "full") {
    const closedIds: string[] = [];
    for (const row of existing) {
      if (row.lifecycle === "rejected" || row.lifecycle === "duplicate" || row.lifecycle === "closed") {
        continue;
      }
      if (seenProviderIds.has(row.provider_id)) continue;
      stats.possiblyClosed += 1;
      closedIds.push(row.id);
    }
    for (const id of closedIds) {
      const row = existing.find((r) => r.id === id);
      if (!row) continue;
      await admin
        .from("food_drink_catalog")
        .update({
          lifecycle: lifecycleAfterMissingFromSync(row.lifecycle),
          verification_status: "needs_review",
          status: "possibly_closed",
          updated_at: now,
        })
        .eq("id", id);
    }
  }

  if (deferEditorialNotes && allNoteQueue.length) {
    await queueEditorialNotes(admin, {
      metroKey: metro.metro_key,
      catalog: "food_drinks",
      city: metro.city,
      places: allNoteQueue,
    });
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
        diagnostics: { possiblyClosed: stats.possiblyClosed, deferEditorialNotes },
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
