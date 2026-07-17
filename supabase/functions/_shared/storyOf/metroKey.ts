/** Stable metro cache key — keep in sync with lib/location/metroKey.ts */

export function metroKeyFromLocation(location: {
  city: string;
  state?: string | null;
  region?: string | null;
}): string {
  const state = location.state?.trim() || location.region?.trim() || "";
  const raw = `${location.city.trim()}-${state}`.toLowerCase();
  return raw
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
