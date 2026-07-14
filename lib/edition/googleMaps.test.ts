import {
  GOOGLE_MAPS_ACTION_LABEL,
  buildGoogleMapsIosAppUrl,
  buildGoogleMapsSearchUrl,
  resolveMapsSearchQuery,
} from "./googleMaps";
import type { MapsDestination } from "./googleMaps";

describe("Google Maps link builder", () => {
  it("prefers coordinates over address and name", () => {
    const dest: MapsDestination = {
      lat: 33.4484,
      lon: -112.074,
      address: "123 Main St",
      name: "Desert Botanical Garden",
      city: "Phoenix",
    };
    expect(resolveMapsSearchQuery(dest)).toBe("33.4484,-112.074");
    expect(buildGoogleMapsSearchUrl(dest)).toBe(
      "https://www.google.com/maps/search/?api=1&query=33.4484%2C-112.074"
    );
  });

  it("uses verified address when coordinates are absent", () => {
    const dest: MapsDestination = {
      address: "123 Main St, Gilbert, AZ",
      name: "The Neighbor's Table",
      city: "Gilbert",
    };
    expect(resolveMapsSearchQuery(dest)).toBe("123 Main St, Gilbert, AZ");
    expect(buildGoogleMapsSearchUrl(dest)).toContain("google.com/maps/search");
    expect(buildGoogleMapsSearchUrl(dest)).not.toContain("maps.apple.com");
    expect(buildGoogleMapsSearchUrl(dest)).not.toMatch(/^geo:/);
  });

  it("uses name plus city and state for NPS parks without coords", () => {
    const dest: MapsDestination = {
      name: "Yosemite National Park",
      state: "CA",
    };
    expect(resolveMapsSearchQuery(dest)).toBe("Yosemite National Park, CA");
  });

  it("returns null when no verified location exists", () => {
    expect(resolveMapsSearchQuery({ name: "Mystery Place" })).toBeNull();
    expect(buildGoogleMapsSearchUrl({})).toBeNull();
  });

  it("builds iOS Google Maps app URLs without Apple Maps schemes", () => {
    const url = buildGoogleMapsIosAppUrl({
      lat: 37.8651,
      lon: -119.5383,
    });
    expect(url).toMatch(/^comgooglemaps:\/\//);
    expect(url).not.toContain("maps.apple.com");
  });

  it("uses the Google Maps action label constant", () => {
    expect(GOOGLE_MAPS_ACTION_LABEL).toBe("Open in Google Maps");
  });
});
