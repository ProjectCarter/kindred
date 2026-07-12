/**
 * Shared helpers for comparing / keying location-dependent edition data.
 */

export function normalizeCityKey(city: string | null | undefined): string {
  return (city ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/,.*$/, "");
}

export function locationKey(place: {
  city: string;
  lat?: number | null;
  lon?: number | null;
}): string {
  const city = normalizeCityKey(place.city);
  const lat =
    place.lat != null && Number.isFinite(place.lat)
      ? place.lat.toFixed(1)
      : "";
  const lon =
    place.lon != null && Number.isFinite(place.lon)
      ? place.lon.toFixed(1)
      : "";
  return `${city}|${lat}|${lon}`;
}

/** True when two cities should be treated as the same place for edition reuse. */
export function citiesMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const na = normalizeCityKey(a);
  const nb = normalizeCityKey(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return na.includes(nb) || nb.includes(na);
}

/** Distance in km (Haversine) — for rejecting far-off event results. */
export function distanceKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
