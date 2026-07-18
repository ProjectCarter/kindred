/**
 * Batch catalog writes — bounded upserts and touch updates.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { chunkArray, CATALOG_BATCH_UPSERT_SIZE } from "../../../../lib/markets/marketBuildEngine.ts";

export async function batchUpsertRows(
  admin: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
  chunkSize = CATALOG_BATCH_UPSERT_SIZE
): Promise<number> {
  if (!rows.length) return 0;
  let written = 0;
  for (const chunk of chunkArray(rows, chunkSize)) {
    const { error } = await admin.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`${table} batch upsert: ${error.message}`);
    written += chunk.length;
  }
  return written;
}

export async function batchTouchByIds(
  admin: SupabaseClient,
  table: string,
  ids: string[],
  patch: Record<string, unknown>,
  chunkSize = CATALOG_BATCH_UPSERT_SIZE
): Promise<number> {
  if (!ids.length) return 0;
  let touched = 0;
  for (const chunk of chunkArray(ids, chunkSize)) {
    const { error } = await admin.from(table).update(patch).in("id", chunk);
    if (error) throw new Error(`${table} batch touch: ${error.message}`);
    touched += chunk.length;
  }
  return touched;
}

export async function queueEditorialNotes(
  admin: SupabaseClient,
  input: {
    metroKey: string;
    catalog: "activities" | "food_drinks";
    city: string;
    places: Array<{ providerId: string; category: string }>;
  }
): Promise<number> {
  if (!input.places.length) return 0;

  const deduped = new Map<string, { providerId: string; category: string }>();
  for (const place of input.places) {
    deduped.set(place.providerId, place);
  }

  const rows = [...deduped.values()].map((p) => ({
    metro_key: input.metroKey,
    catalog: input.catalog,
    provider_id: p.providerId,
    provider_category: p.category,
    city: input.city,
    status: "pending",
    updated_at: new Date().toISOString(),
  }));

  if (!rows.length) return 0;
  const { error } = await admin
    .from("kindred_market_editorial_note_queue")
    .upsert(rows, { onConflict: "metro_key,catalog,provider_id" });

  if (error) throw new Error(`editorial note queue: ${error.message}`);
  return rows.length;
}
