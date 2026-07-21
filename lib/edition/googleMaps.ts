/**
 * Google Maps link builder — free universal URLs only.
 * No Google Maps Platform API key, no billable Places/Geocoding requests.
 *
 * Uses the documented Maps URLs format:
 * https://www.google.com/maps/search/?api=1&query=...
 * (The `api=1` flag enables URL parsing — not a paid API integration.)
 */

import { Linking, Platform } from "react-native";
import { trackEvent } from "../analytics/trackEvent";
import { isUsableStreetAddress } from "./verifiedLocation";

export const GOOGLE_MAPS_ACTION_LABEL = "Open in Google Maps";

/** Verified location fields — never invent missing pieces. */
export type MapsDestination = {
  lat?: number | null;
  lon?: number | null;
  address?: string | null;
  name?: string | null;
  city?: string | null;
  region?: string | null;
  state?: string | null;
};

function isValidCoord(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Resolve the Maps search query from verified data only.
 * Priority: coordinates → street address → name + city + region/state.
 */
export function resolveMapsSearchQuery(dest: MapsDestination): string | null {
  if (isValidCoord(dest.lat) && isValidCoord(dest.lon)) {
    return `${dest.lat},${dest.lon}`;
  }

  const address = dest.address?.trim();
  if (address && isUsableStreetAddress(address)) return address;

  const name = dest.name?.trim();
  const city = dest.city?.trim();
  const region = dest.region?.trim() || dest.state?.trim();

  if (name && (city || region)) {
    return [name, city, region].filter(Boolean).join(", ");
  }

  return null;
}

/** HTTPS Google Maps search URL — browser fallback and Android app-link target. */
export function buildGoogleMapsSearchUrl(dest: MapsDestination): string | null {
  const query = resolveMapsSearchQuery(dest);
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** iOS Google Maps app deep link — same verified query, no Apple Maps. */
export function buildGoogleMapsIosAppUrl(dest: MapsDestination): string | null {
  const query = resolveMapsSearchQuery(dest);
  if (!query) return null;
  return `comgooglemaps://?q=${encodeURIComponent(query)}`;
}

/**
 * Open a verified destination in Google Maps.
 * iOS: Google Maps app when installed (`comgooglemaps://`), else Safari.
 * Android: HTTPS app link opens Google Maps when installed, else browser.
 * Never uses Apple Maps, `geo:`, or the device default maps handler.
 */
export async function openGoogleMapsDestination(
  dest: MapsDestination
): Promise<boolean> {
  const webUrl = buildGoogleMapsSearchUrl(dest);
  if (!webUrl) return false;

  if (Platform.OS === "ios") {
    const appUrl = buildGoogleMapsIosAppUrl(dest);
    if (appUrl) {
      try {
        const canOpen = await Linking.canOpenURL(appUrl);
        if (canOpen) {
          await Linking.openURL(appUrl);
          trackEvent("maps_opened");
          return true;
        }
      } catch {
        /* Fall through to HTTPS — app not installed or query blocked. */
      }
    }
  }

  try {
    await Linking.openURL(webUrl);
    trackEvent("maps_opened");
    return true;
  } catch {
    return false;
  }
}

/** @deprecated Use buildGoogleMapsSearchUrl with a MapsDestination instead. */
export function buildMapsUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
