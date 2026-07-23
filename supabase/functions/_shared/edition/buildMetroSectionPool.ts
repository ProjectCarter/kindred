/**
 * Build metro-wide candidate pools — generation once per metro refresh window.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getLocalEvents } from "../localEvents/provider.ts";
import type { LocalEventLocation } from "../localEvents/provider.ts";
import { filterLocalEventsByMarket, filterPlacesByMarket } from "../markets/editionMarket.ts";
import { filterFamilyFriendlyEvents } from "../localEvents/familyFriendlyFilter.ts";
import { filterEventsForLocalEventsDesk } from "./editionSectionOwnership.ts";
import { surfaceLocalEventsForEdition } from "../localEvents/surfaceLocalEventsForEdition.ts";
import { LOCAL_EVENTS_EDITION_SURFACED_MAX } from "../editorial/publishing.ts";
import { getLocalPlacesForEdition } from "../places/index.ts";
import {
  listApprovedHistoryPlaces,
  rowToSnapshot,
} from "../historyAroundTown/library.ts";
import type { HistoryPlaceRow, HistoryPlaceSnapshot } from "../historyAroundTown/types.ts";
import { libraryMetroKeysForLocation } from "../../../../lib/markets/libraryMetroKeys.ts";
import {
  buildMetroEventsPoolPayload,
  buildMetroHistoryPoolPayload,
  buildMetroPlacesPoolPayload,
} from "../../../../lib/edition/metroPoolPayload.ts";
import type { LocalEvent } from "../localEvents/provider.ts";
import type { NormalizedPlace, PlacesLocation } from "../places/types.ts";
import type { ResolvedEditionMarket } from "../../../../lib/markets/resolveEditionMarket.ts";

export type MetroPoolBuildContext = {
  location: PlacesLocation;
  catalogMetroKey: string;
  editionDate: string;
  editionMarket?: ResolvedEditionMarket | null;
  marketAnchor?: PlacesLocation | null;
  traceId?: string | null;
};

export async function buildMetroEventsCandidatePool(
  admin: SupabaseClient,
  ctx: MetroPoolBuildContext,
  options?: { allowAiEnrichment?: boolean }
): Promise<ReturnType<typeof buildMetroEventsPoolPayload>> {
  let raw = await getLocalEvents(ctx.location as LocalEventLocation, {
    admin,
    catalogMetroKey: ctx.catalogMetroKey,
    editionDate: ctx.editionDate,
    forMetroPool: true,
  });

  if (ctx.editionMarket && ctx.marketAnchor) {
    raw = filterLocalEventsByMarket(raw, ctx.editionMarket, ctx.marketAnchor).kept;
  }

  const familyFiltered = filterFamilyFriendlyEvents(raw);
  const owned = filterEventsForLocalEventsDesk(familyFiltered.kept);

  const enriched = await surfaceLocalEventsForEdition(owned.kept, [], {
    editionDate: ctx.editionDate,
    allowAiEnrichment: options?.allowAiEnrichment === true,
    editorialTarget: LOCAL_EVENTS_EDITION_SURFACED_MAX,
  });

  return buildMetroEventsPoolPayload({
    eventsPool: enriched as LocalEvent[],
    foodDrinkEventReroutes: owned.reroutedFood,
  });
}

export async function buildMetroPlacesCandidatePool(
  admin: SupabaseClient,
  ctx: MetroPoolBuildContext
): Promise<ReturnType<typeof buildMetroPlacesPoolPayload>> {
  let places = await getLocalPlacesForEdition(admin, ctx.location, {
    catalogMetroKey: ctx.catalogMetroKey,
  });
  if (ctx.editionMarket && ctx.marketAnchor) {
    places = filterPlacesByMarket(places, ctx.editionMarket, ctx.marketAnchor).kept;
  }
  return buildMetroPlacesPoolPayload(places as NormalizedPlace[]);
}

export async function buildMetroHistoryCandidatePool(
  admin: SupabaseClient,
  location: PlacesLocation
): Promise<ReturnType<typeof buildMetroHistoryPoolPayload>> {
  const city = location.city?.trim();
  if (!city || city.toLowerCase() === "your area") {
    return buildMetroHistoryPoolPayload([]);
  }

  const metroKeys = libraryMetroKeysForLocation({
    city,
    state: location.state,
    region: location.region,
    lat: location.lat ?? NaN,
    lon: location.lon ?? NaN,
  });

  let rows: HistoryPlaceRow[] = [];
  for (const key of metroKeys) {
    const found = await listApprovedHistoryPlaces(admin, key);
    if (found.length) {
      rows = found;
      break;
    }
  }

  if (!rows.length) {
    console.warn("[historyAroundTown:metroPool] no approved places", { metroKeys });
    return buildMetroHistoryPoolPayload([]);
  }

  const slugIndex = new Map(rows.map((row) => [row.slug, row]));
  const snapshots = rows
    .map((row) => rowToSnapshot(row, slugIndex))
    .filter((place): place is HistoryPlaceSnapshot => place != null);
  return buildMetroHistoryPoolPayload(snapshots);
}
