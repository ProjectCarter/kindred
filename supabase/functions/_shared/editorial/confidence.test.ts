import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  computeDiscoveryConfidence,
  computeEventConfidence,
  shouldPublishEditorialConfidence,
} from "./confidence.ts";
import type { DiscoveryItem } from "../discovery/types.ts";
import type { LocalEvent } from "../localEvents/provider.ts";

function placeItem(overrides: Partial<DiscoveryItem> = {}): DiscoveryItem {
  return {
    id: "place_fs_abc",
    title: "Joe's Coffee Roasters",
    dek: "A calm neighborhood roaster with room to sit and read the paper.",
    category: "coffee",
    family: "food_drink",
    place: { city: "Gilbert" },
    source: { name: "Foursquare", tier: "local", url: "https://joescoffee.example" },
    url: "https://joescoffee.example",
    address: "123 Main St",
    lat: 33.35,
    lon: -111.79,
    venueCategories: ["Coffee Shop"],
    tags: ["local_place", "verified"],
    seasons: ["anytime"],
    weatherFit: ["any"],
    popularity: 0.35,
    uniqueness: 0.5,
    localExpertise: 0.85,
    quality: 0.65,
    ...overrides,
  };
}

function templateItem(): DiscoveryItem {
  return placeItem({
    id: "disc_coffee_third_wave",
    title: "A quiet café worth finding",
    dek: "Look for a calm local shop with room to sit — skip the viral lists.",
    source: { name: "Kindred Desk", tier: "kindred" },
    url: null,
    address: null,
    lat: null,
    lon: null,
    venueCategories: [],
    tags: ["coffee", "template"],
  });
}

function event(overrides: Partial<LocalEvent> = {}): LocalEvent {
  return {
    name: "Summer Concert Series",
    startDateTime: "Sat, Jul 18, 7 PM",
    venue: "Downtown Amphitheater",
    city: "Gilbert",
    sourceUrl: "https://cityofgilbert.gov/events/concert",
    sourceName: "City of Gilbert",
    sourceTier: "official",
    ...overrides,
  };
}

Deno.test("verified local place scores high enough to publish", () => {
  const result = computeDiscoveryConfidence(placeItem());
  assertEquals(result.score >= 80, true);
  assertEquals(result.verified, true);
  assertEquals(result.completeness, true);
  assertEquals(shouldPublishEditorialConfidence(result), true);
});

Deno.test("template place names are rejected", () => {
  const result = computeDiscoveryConfidence(templateItem());
  assertEquals(result.score < 70, true);
  assertEquals(result.action, "reject");
  assertEquals(shouldPublishEditorialConfidence(result), false);
});

Deno.test("official event publishes with high confidence", () => {
  const result = computeEventConfidence(
    event({
      imageUrl: "https://cityofgilbert.gov/photo.jpg",
      imageSource: "provider_thumbnail",
    })
  );
  assertEquals(result.score >= 80, true);
  assertEquals(shouldPublishEditorialConfidence(result), true);
});

Deno.test("thin generic event is rejected", () => {
  const result = computeEventConfidence(
    event({
      name: "Events Near You",
      venue: "",
      sourceUrl: "",
      sourceTier: "aggregator",
      startDateTime: "Time TBA",
    })
  );
  assertEquals(result.score < 70, true);
  assertEquals(shouldPublishEditorialConfidence(result), false);
});

Deno.test("when in doubt leave it out — weak listings stay unpublished", () => {
  const discovery = computeDiscoveryConfidence(
    placeItem({
      title: "A quiet café worth finding",
      tags: ["template"],
      source: { name: "Kindred Desk", tier: "kindred" },
      url: null,
      address: null,
    })
  );
  const localEvent = computeEventConfidence(
    event({
      name: "Live Music",
      venue: "Venue TBA",
      sourceUrl: "https://aggregator.example/e/1",
      sourceTier: "aggregator",
    })
  );
  assertEquals(shouldPublishEditorialConfidence(discovery), false);
  assertEquals(shouldPublishEditorialConfidence(localEvent), false);
});
