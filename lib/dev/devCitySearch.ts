import { SUGGESTED_CITIES } from "../location/cities";
import { searchCities } from "../location/kindredLocation";
import type { KindredPlace } from "../location/types";

export type DevCitySearchFilters = {
  country?: string;
  state?: string;
};

function matchesFilters(place: KindredPlace, filters?: DevCitySearchFilters): boolean {
  if (!filters) return true;
  const country = filters.country?.trim().toLowerCase();
  const state = filters.state?.trim().toLowerCase();
  if (state) {
    const hay = `${place.state ?? ""} ${place.region ?? ""}`.toLowerCase();
    if (!hay.includes(state)) return false;
  }
  if (country) {
    const hay = `${place.region ?? ""} ${place.state ?? ""} ${place.city}`.toLowerCase();
    if (country === "us" || country === "usa" || country === "united states") {
      if (!place.state) return false;
    } else if (!hay.includes(country)) {
      return false;
    }
  }
  return true;
}

/** QA presets — extends curated cities; add entries in lib/location/cities.ts. */
export const DEV_QA_CITY_PRESETS: KindredPlace[] = [
  ...SUGGESTED_CITIES.filter((c) =>
    [
      "Gilbert",
      "Phoenix",
      "Seattle",
      "San Diego",
      "Denver",
      "Chicago",
      "New York",
      "London",
      "Paris",
      "Rome",
      "Tokyo",
      "Sydney",
      "Toronto",
    ].includes(c.city)
  ),
];

export async function searchDevEditionCities(
  query: string,
  filters?: DevCitySearchFilters
): Promise<KindredPlace[]> {
  const fromSearch = await searchCities(query);
  const merged = [...DEV_QA_CITY_PRESETS, ...fromSearch, ...SUGGESTED_CITIES];
  const seen = new Set<string>();
  const out: KindredPlace[] = [];
  for (const place of merged) {
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
