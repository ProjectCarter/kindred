import { SUGGESTED_CITIES } from "../location/cities";
import { searchCities } from "../location/kindredLocation";
import type { KindredPlace } from "../location/types";
import { isUsKindredPlace } from "../markets/usOnly";

export type DevCitySearchFilters = {
  state?: string;
};

function matchesFilters(place: KindredPlace, filters?: DevCitySearchFilters): boolean {
  if (!isUsKindredPlace(place)) return false;
  if (!filters?.state?.trim()) return true;
  const state = filters.state.trim().toLowerCase();
  const hay = `${place.state ?? ""} ${place.region ?? ""}`.toLowerCase();
  return hay.includes(state);
}

/** United States QA presets for Developer Tools edition override. */
export const DEV_QA_CITY_PRESETS: KindredPlace[] = SUGGESTED_CITIES.filter((c) =>
  isUsKindredPlace(c) &&
  [
    "Gilbert",
    "Phoenix",
    "Seattle",
    "San Diego",
    "Denver",
    "Chicago",
    "New York",
    "Los Angeles",
    "Austin",
    "Portland",
  ].includes(c.city)
);

export async function searchDevEditionCities(
  query: string,
  filters?: DevCitySearchFilters
): Promise<KindredPlace[]> {
  const fromSearch = await searchCities(query);
  const merged = [...DEV_QA_CITY_PRESETS, ...fromSearch, ...SUGGESTED_CITIES];
  const seen = new Set<string>();
  const out: KindredPlace[] = [];
  for (const place of merged) {
    if (!isUsKindredPlace(place)) continue;
    const key = `${place.city}|${place.lat}|${place.lon}`;
    if (seen.has(key)) continue;
    if (!matchesFilters(place, filters)) continue;
    seen.add(key);
    out.push(place);
  }
  const q = query.trim().toLowerCase();
  if (!q) return out.slice(0, 16);
  return out
    .filter((place) => {
      const hay = `${place.city} ${place.region ?? ""} ${place.state ?? ""}`.toLowerCase();
      return hay.includes(q);
    })
    .slice(0, 16);
}
