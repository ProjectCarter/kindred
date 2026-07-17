/**
 * Shared catalog bootstrap — edition completeness must not fail while metro
 * catalogs are registered but awaiting their first scheduled sync.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export type CatalogBootstrapState = {
  eventsCatalogBootstrapped: boolean;
  activitiesCatalogBootstrapped: boolean;
  foodDrinkCatalogBootstrapped: boolean;
};

export async function getCatalogBootstrapState(
  admin: SupabaseClient,
  metroKey: string | null | undefined
): Promise<CatalogBootstrapState> {
  if (!metroKey?.trim()) {
    return {
      eventsCatalogBootstrapped: false,
      activitiesCatalogBootstrapped: false,
      foodDrinkCatalogBootstrapped: false,
    };
  }

  const key = metroKey.trim();
  const [eventsRes, activitiesRes, foodRes] = await Promise.all([
    admin
      .from("events_catalog_metros")
      .select("initial_import_completed_at")
      .eq("metro_key", key)
      .maybeSingle(),
    admin
      .from("activities_catalog_metros")
      .select("initial_import_completed_at")
      .eq("metro_key", key)
      .maybeSingle(),
    admin
      .from("food_drink_catalog_metros")
      .select("initial_import_completed_at")
      .eq("metro_key", key)
      .maybeSingle(),
  ]);

  return {
    eventsCatalogBootstrapped: Boolean(eventsRes.data?.initial_import_completed_at),
    activitiesCatalogBootstrapped: Boolean(
      activitiesRes.data?.initial_import_completed_at
    ),
    foodDrinkCatalogBootstrapped: Boolean(foodRes.data?.initial_import_completed_at),
  };
}
