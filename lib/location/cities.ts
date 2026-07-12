import type { KindredPlace } from "./types";

/**
 * Curated cities for calm manual pickers.
 * Lat/lon are city centers — good enough for weather / local events queries.
 */
export const SUGGESTED_CITIES: KindredPlace[] = [
  { city: "Phoenix", region: "Arizona", state: "AZ", lat: 33.4484, lon: -112.074 },
  { city: "Seattle", region: "Washington", state: "WA", lat: 47.6062, lon: -122.3321 },
  { city: "Denver", region: "Colorado", state: "CO", lat: 39.7392, lon: -104.9903 },
  { city: "San Diego", region: "California", state: "CA", lat: 32.7157, lon: -117.1611 },
  { city: "Los Angeles", region: "California", state: "CA", lat: 34.0522, lon: -118.2437 },
  { city: "San Francisco", region: "California", state: "CA", lat: 37.7749, lon: -122.4194 },
  { city: "Portland", region: "Oregon", state: "OR", lat: 45.5152, lon: -122.6784 },
  { city: "Chicago", region: "Illinois", state: "IL", lat: 41.8781, lon: -87.6298 },
  { city: "New York", region: "New York", state: "NY", lat: 40.7128, lon: -74.006 },
  { city: "Boston", region: "Massachusetts", state: "MA", lat: 42.3601, lon: -71.0589 },
  { city: "Austin", region: "Texas", state: "TX", lat: 30.2672, lon: -97.7431 },
  { city: "Miami", region: "Florida", state: "FL", lat: 25.7617, lon: -80.1918 },
  { city: "London", region: "England", state: null, lat: 51.5074, lon: -0.1278 },
  { city: "Tokyo", region: "Japan", state: null, lat: 35.6762, lon: 139.6503 },
  { city: "Paris", region: "France", state: null, lat: 48.8566, lon: 2.3522 },
  { city: "Toronto", region: "Ontario", state: null, lat: 43.6532, lon: -79.3832 },
];

export function filterSuggestedCities(query: string): KindredPlace[] {
  const q = query.trim().toLowerCase();
  if (!q) return SUGGESTED_CITIES.slice(0, 8);
  return SUGGESTED_CITIES.filter(
    (c) =>
      c.city.toLowerCase().includes(q) ||
      (c.region && c.region.toLowerCase().includes(q)) ||
      (c.state && c.state.toLowerCase().includes(q))
  ).slice(0, 12);
}

export function formatPlaceLabel(place: KindredPlace): string {
  if (place.state) return `${place.city}, ${place.state}`;
  if (place.region) return `${place.city}, ${place.region}`;
  return place.city;
}
