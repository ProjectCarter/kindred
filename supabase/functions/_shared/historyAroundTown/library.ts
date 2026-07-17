import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { metroKeyFromLocation } from "../storyOf/metroKey.ts";
import {
  computeHistoryPlaceValidationStatus,
  isApprovedHistoryPlace,
} from "./validation.ts";
import type {
  HistoryAroundTownEditionPayload,
  HistoryPlaceEditorialModule,
  HistoryPlaceRow,
  HistoryPlaceSnapshot,
} from "./types.ts";
import {
  CATEGORY_LABELS,
  HISTORY_AROUND_TOWN_CAROUSEL_LIMIT,
  HISTORY_AROUND_TOWN_SUBTITLE,
} from "./types.ts";

function splitBody(body: string): string[] {
  return body
    .trim()
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 20);
}

function modulesFromRow(row: HistoryPlaceRow): HistoryPlaceEditorialModule[] {
  const stored = Array.isArray(row.editorial_modules)
    ? row.editorial_modules.filter((m) => m?.body?.trim())
    : [];

  if (stored.length >= 4) return stored;

  const built: HistoryPlaceEditorialModule[] = [];
  if (row.history_summary?.trim()) {
    built.push({ id: "history", label: "History", body: row.history_summary.trim() });
  }
  if (row.why_it_matters?.trim()) {
    built.push({
      id: "why_it_matters",
      label: "Why it matters",
      body: row.why_it_matters.trim(),
    });
  }
  if (row.interesting_facts?.length) {
    built.push({
      id: "interesting_facts",
      label: "Interesting facts",
      body: row.interesting_facts.map((f) => f.trim()).filter(Boolean).join(" "),
    });
  }
  if (row.architecture_note?.trim()) {
    built.push({
      id: "architecture",
      label: "Architecture",
      body: row.architecture_note.trim(),
    });
  }
  if (row.best_time_to_visit?.trim()) {
    built.push({
      id: "best_time",
      label: "Best time to visit",
      body: row.best_time_to_visit.trim(),
    });
  }
  if (row.hours_text?.trim()) {
    built.push({ id: "hours", label: "Hours", body: row.hours_text.trim() });
  }
  if (row.admission_text?.trim()) {
    built.push({
      id: "admission",
      label: "Admission",
      body: row.admission_text.trim(),
    });
  }
  if (row.parking_text?.trim()) {
    built.push({ id: "parking", label: "Parking", body: row.parking_text.trim() });
  }
  if (row.accessibility_text?.trim()) {
    built.push({
      id: "accessibility",
      label: "Accessibility",
      body: row.accessibility_text.trim(),
    });
  }
  if (row.nearby_places?.length) {
    built.push({
      id: "nearby",
      label: "Nearby places",
      body: row.nearby_places.join(" · "),
    });
  }

  return built.length ? built : stored;
}

export function rowToSnapshot(row: HistoryPlaceRow): HistoryPlaceSnapshot | null {
  if (!isApprovedHistoryPlace(row)) return null;

  const body = splitBody(row.story_body);
  if (body.length < 2) return null;

  return {
    id: row.id,
    slug: row.slug,
    placeName: row.place_name.trim(),
    category: row.category,
    categoryLabel: row.category_label?.trim() || CATEGORY_LABELS[row.category],
    teaser: row.editorial_teaser.trim(),
    body,
    modules: modulesFromRow(row),
    closingNote: row.closing_note?.trim() ?? null,
    heroImageUrl: row.hosted_url?.trim() || row.image_url?.trim() || null,
    imageCredit: row.image_credit?.trim() ?? null,
    lat: row.lat,
    lon: row.lon,
    address: row.address?.trim() ?? null,
    city: row.city?.trim() ?? null,
    state: row.state?.trim() ?? null,
    officialWebsite: row.official_website?.trim() ?? null,
    nearbyPlaces: (row.nearby_places ?? []).map((p) => p.trim()).filter(Boolean),
  };
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
  location: { city: string; state?: string | null; region?: string | null }
): Promise<HistoryAroundTownEditionPayload | null> {
  const city = location.city?.trim();
  if (!city || city.toLowerCase() === "your area") return null;

  const metroKey = metroKeyFromLocation(location);
  const rows = await listApprovedHistoryPlaces(admin, metroKey);
  if (!rows.length) {
    console.warn("[historyAroundTown] no approved places", { metroKey });
    return null;
  }

  const carouselRows = diversifyCarousel(rows);
  const places = rows
    .map((row) => rowToSnapshot(row))
    .filter((p): p is HistoryPlaceSnapshot => p != null);

  const carousel = carouselRows
    .map((row) => rowToSnapshot(row))
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
    carousel: payload.carousel,
    places: payload.places,
  };
}

export { computeHistoryPlaceValidationStatus, metroKeyFromLocation };
