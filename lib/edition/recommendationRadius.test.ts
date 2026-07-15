import type { RankedDiscoveryItem } from "./discovery";
import {
  compareByLocalProximity,
  isWithinLocalDiscoveryRadius,
  isWithinActivitiesSectionRadius,
} from "./localDiscoveryScope";

const GILBERT = { lat: 33.3528, lon: -111.789 };

function ranked(
  partial: Partial<RankedDiscoveryItem["item"]> & {
    title: string;
    category: RankedDiscoveryItem["item"]["category"];
  },
  score = 80
): RankedDiscoveryItem {
  return {
    item: {
      id: partial.id ?? "test",
      title: partial.title,
      dek: "",
      category: partial.category,
      family: "outdoors",
      source: { name: "Foursquare", tier: "local" },
      tags: partial.tags ?? ["local_place", "verified"],
      seasons: ["anytime"],
      weatherFit: ["any"],
      popularity: 0.5,
      uniqueness: 0.5,
      localExpertise: 0.8,
      quality: 0.8,
      lat: partial.lat ?? null,
      lon: partial.lon ?? null,
    },
    score,
    surfaces: [],
    reasons: [],
  };
}

describe("local discovery radius", () => {
  it("accepts a nearby local museum", () => {
    const item = ranked({
      title: "Downtown Coffee",
      category: "coffee",
      lat: 33.36,
      lon: -111.79,
    });
    expect(isWithinLocalDiscoveryRadius(item, GILBERT)).toBe(true);
  });

  it("rejects Organ Pipe Cactus National Monument for a Gilbert reader", () => {
    const item = ranked({
      title: "Organ Pipe Cactus National Monument",
      category: "museums",
      lat: 31.9544,
      lon: -112.7997,
      tags: ["nps_park", "outdoors", "verified", "national_park"],
    });
    expect(isWithinLocalDiscoveryRadius(item, GILBERT)).toBe(false);
  });

  it("rejects Chiricahua National Monument even when categorized as museums", () => {
    const item = ranked({
      title: "Chiricahua National Monument",
      category: "museums",
      lat: 32.0142,
      lon: -109.3567,
      tags: ["nps_park", "outdoors", "verified", "national_park"],
    });
    expect(isWithinLocalDiscoveryRadius(item, GILBERT)).toBe(false);
  });

  it("rejects venues beyond 25 miles even without nps tags", () => {
    const item = ranked({
      title: "Far Museum",
      category: "museums",
      lat: 34.5,
      lon: -111.0,
    });
    expect(isWithinLocalDiscoveryRadius(item, GILBERT)).toBe(false);
  });

  it("sorts closer venues ahead of higher-scored far ones", () => {
    const near = ranked(
      { title: "Neighborhood Park", category: "parks", lat: 33.36, lon: -111.79 },
      70
    );
    const far = ranked(
      { title: "Distant Garden", category: "gardens", lat: 34.2, lon: -110.5 },
      95
    );
    expect(compareByLocalProximity(near, far, GILBERT)).toBeLessThan(0);
  });

  it("rejects activities beyond 25 miles", () => {
    const item = ranked({
      title: "Far Escape Room",
      category: "activities",
      lat: 34.5,
      lon: -111.0,
    });
    expect(isWithinActivitiesSectionRadius(item, GILBERT)).toBe(false);
  });

  it("keeps edition-curated items when provider coords are missing", () => {
    const activity = ranked({
      title: "Neighborhood Bowling",
      category: "activities",
      lat: null,
      lon: null,
    });
    const coffee = ranked({
      title: "Neighborhood Coffee",
      category: "coffee",
      lat: null,
      lon: null,
    });
    expect(isWithinActivitiesSectionRadius(activity, GILBERT)).toBe(true);
    expect(isWithinLocalDiscoveryRadius(coffee, GILBERT)).toBe(true);
  });

  it("accepts string coordinates within radius", () => {
    const item = ranked({
      title: "String Coords Coffee",
      category: "coffee",
      lat: "33.36" as unknown as number,
      lon: "-111.79" as unknown as number,
    });
    expect(isWithinLocalDiscoveryRadius(item, GILBERT)).toBe(true);
  });
});
