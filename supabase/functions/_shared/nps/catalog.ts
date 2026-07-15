import type { DiscoveryItem } from "../discovery/types.ts";
import { CATEGORY_FAMILY } from "../discovery/taxonomy.ts";
import type { NpsParkRecord } from "./types.ts";
import { normalizeOfficialWebsite, pickOfficialWebsiteFromUrls } from "../editorial/officialWebsite.ts";

function discoveryItem(
  partial: Omit<DiscoveryItem, "family"> & { family?: DiscoveryItem["family"] }
): DiscoveryItem {
  const officialWebsite =
    normalizeOfficialWebsite(partial.officialWebsite) ??
    pickOfficialWebsiteFromUrls([partial.url, partial.source?.url]);
  return {
    ...partial,
    ...(officialWebsite ? { officialWebsite } : {}),
    family: partial.family ?? CATEGORY_FAMILY[partial.category],
  };
}

function designationCategory(designation: string): DiscoveryItem["category"] {
  const d = designation.toLowerCase();
  if (/historic site|monument|memorial|battlefield|heritage/i.test(d)) {
    return "museums";
  }
  if (/recreation area|scenic|river|seashore|parkway/i.test(d)) {
    return "scenic_drives";
  }
  return "hiking";
}

function weatherFitForPark(designation: string): string[] {
  const d = designation.toLowerCase();
  if (/historic site|monument|memorial/i.test(d)) {
    return ["any", "rainy", "cool", "fair"];
  }
  return ["fair", "cool"];
}

/**
 * NPS parks → discovery candidates. Every field traces to NPS API data.
 */
export function npsParksAsDiscoveryItems(parks: NpsParkRecord[]): DiscoveryItem[] {
  return parks.map((park) => {
    const category = designationCategory(park.designation);
    const dek =
      park.weatherHint?.trim() ||
      park.description.slice(0, 220).trim() ||
      `${park.fullName} — official National Park Service listing.`;

    return discoveryItem({
      id: `nps_${park.parkCode}`,
      title: park.fullName,
      dek,
      category,
      place: { city: null, state: park.states.split(",")[0]?.trim() ?? null },
      source: {
        name: "National Park Service",
        tier: "guide",
        url: park.url,
      },
      url: park.url,
      officialWebsite: normalizeOfficialWebsite(park.url),
      lat: park.lat,
      lon: park.lon,
      providerConfidence: park.confidence,
      venueCategories: [park.designation, "National Park Service"],
      tags: ["nps_park", "outdoors", "verified", "national_park"],
      seasons: ["anytime"],
      weatherFit: weatherFitForPark(park.designation),
      popularity: 0.55,
      uniqueness: 0.85,
      localExpertise: 0.9,
      quality: 0.88,
    });
  });
}
