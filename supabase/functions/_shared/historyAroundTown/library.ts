import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { libraryMetroKeysForLocation } from "../../../../lib/markets/libraryMetroKeys.ts";
import { metroKeyFromLocation } from "../storyOf/metroKey.ts";
import {
  computeHistoryPlaceValidationStatus,
  isApprovedHistoryPlace,
} from "./validation.ts";
import { buildHistoryPlaceSnapshot } from "./snapshot.ts";
import { normalizeHistoryPlaceSnapshot } from "./normalize.ts";
import type {
  HistoryAroundTownEditionPayload,
  HistoryPlaceRow,
  HistoryPlaceSnapshot,
} from "./types.ts";
import {
  HISTORY_AROUND_TOWN_CAROUSEL_LIMIT,
  HISTORY_AROUND_TOWN_SUBTITLE,
} from "./types.ts";

export function rowToSnapshot(
  row: HistoryPlaceRow,
  slugIndex?: Map<string, HistoryPlaceRow>
): HistoryPlaceSnapshot | null {
  if (!isApprovedHistoryPlace(row)) return null;
  return buildHistoryPlaceSnapshot(row, slugIndex);
}

export async function listApprovedHistoryPlaces(
  admin: SupabaseClient,
  metroKey: string
): Promise<HistoryPlaceRow[]> {
  const { data, error } = await admin
    .from("kindred_history_places")
    .select("*")
    .eq("metro_key", metroKey)
    .eq("validation_status", "approved")
    .order("featured", { ascending: false })
    .order("editorial_priority", { ascending: false })
    .order("place_name", { ascending: true });

  if (error) {
    console.warn("[historyAroundTown] library query failed", {
      metroKey,
      message: error.message,
    });
    return [];
  }

  return (data ?? []) as HistoryPlaceRow[];
}

function diversifyCarousel(rows: HistoryPlaceRow[]): HistoryPlaceRow[] {
  const byCategory = new Map<string, HistoryPlaceRow[]>();
  for (const row of rows) {
    const list = byCategory.get(row.category) ?? [];
    list.push(row);
    byCategory.set(row.category, list);
  }

  const picked: HistoryPlaceRow[] = [];
  const seen = new Set<string>();
  const categories = [...byCategory.keys()];

  while (picked.length < HISTORY_AROUND_TOWN_CAROUSEL_LIMIT) {
    let added = false;
    for (const cat of categories) {
      const pool = byCategory.get(cat) ?? [];
      const next = pool.find((r) => !seen.has(r.id));
      if (!next) continue;
      picked.push(next);
      seen.add(next.id);
      added = true;
      if (picked.length >= HISTORY_AROUND_TOWN_CAROUSEL_LIMIT) break;
    }
    if (!added) break;
  }

  if (picked.length < HISTORY_AROUND_TOWN_CAROUSEL_LIMIT) {
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      picked.push(row);
      seen.add(row.id);
      if (picked.length >= HISTORY_AROUND_TOWN_CAROUSEL_LIMIT) break;
    }
  }

  return picked;
}

export async function buildHistoryAroundTownForEdition(
  admin: SupabaseClient,
  location: {
    city: string;
    state?: string | null;
    region?: string | null;
    lat?: number;
    lon?: number;
  }
): Promise<HistoryAroundTownEditionPayload | null> {
  const city = location.city?.trim();
  if (!city || city.toLowerCase() === "your area") return null;

  const metroKeys = libraryMetroKeysForLocation({
    city,
    state: location.state,
    region: location.region,
    lat: location.lat ?? NaN,
    lon: location.lon ?? NaN,
  });

  let metroKey = metroKeys[0] ?? metroKeyFromLocation(location);
  let rows: HistoryPlaceRow[] = [];

  for (const key of metroKeys) {
    const found = await listApprovedHistoryPlaces(admin, key);
    if (found.length) {
      metroKey = key;
      rows = found;
      break;
    }
  }

  if (!rows.length) {
    console.warn("[historyAroundTown] no approved places", { metroKeys });
    return null;
  }

  const slugIndex = new Map(rows.map((row) => [row.slug, row]));
  const carouselRows = diversifyCarousel(rows);
  const places = rows
    .map((row) => rowToSnapshot(row, slugIndex))
    .filter((p): p is HistoryPlaceSnapshot => p != null);

  const carousel = carouselRows
    .map((row) => rowToSnapshot(row, slugIndex))
    .filter((p): p is HistoryPlaceSnapshot => p != null);

  if (!carousel.length || !places.length) return null;

  return {
    metroKey,
    subtitle: HISTORY_AROUND_TOWN_SUBTITLE,
    carousel,
    places,
  };
}

export function parseHistoryAroundTownPayload(
  raw: unknown
): HistoryAroundTownEditionPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as HistoryAroundTownEditionPayload;
  if (!payload.metroKey?.trim()) return null;
  if (!Array.isArray(payload.places) || !payload.places.length) return null;
  if (!Array.isArray(payload.carousel) || !payload.carousel.length) return null;
  return {
    metroKey: payload.metroKey,
    subtitle: payload.subtitle?.trim() || HISTORY_AROUND_TOWN_SUBTITLE,
    carousel: payload.carousel.map(normalizeHistoryPlaceSnapshot),
    places: payload.places.map(normalizeHistoryPlaceSnapshot),
  };
}

export { computeHistoryPlaceValidationStatus, metroKeyFromLocation };
