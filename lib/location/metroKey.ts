import type { KindredPlace } from "./types";

/** Stable metro cache key — matches supabase/functions/_shared/places/cache.ts */
export function metroKeyFromPlace(place: {
  city: string;
  state?: string | null;
  region?: string | null;
}): string {
  const state = place.state?.trim() || place.region?.trim() || "";
  const raw = `${place.city.trim()}-${state}`.toLowerCase();
  return raw
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function metroKeyFromKindredPlace(place: KindredPlace): string {
  return metroKeyFromPlace(place);
}
