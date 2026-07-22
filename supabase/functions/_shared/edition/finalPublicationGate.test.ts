import {
  gateLocalEventsForPublication,
  gateDiscoveryPayloadForPublication,
} from "./finalPublicationGate.ts";
import type { LocalEvent } from "../localEvents/provider.ts";
import type { DiscoveryPayload } from "../discovery/types.ts";

function baseEvent(overrides: Partial<LocalEvent> = {}): LocalEvent {
  return {
    name: "Community Jazz Night",
    venue: "Downtown Arts Center",
    city: "Seattle",
    startDateTime: "Jul 20, 2026 · 7:00 PM",
    startDateIso: "2026-07-20",
    startTimeIso: "19:00",
    sourceUrl: "https://www.eventbrite.com/e/community-jazz-night-123",
    sourceName: "Eventbrite",
    sourceId: "eventbrite",
    sourceTier: "aggregator",
    dateSourceType: "official_ticketing_page",
    dateSourceUrl: "https://www.eventbrite.com/e/community-jazz-night-123",
    officialWebsite: "https://www.seattle.gov/arts",
    editorialHeadline: "Jazz returns to the arts center",
    banditNote: "Downtown Arts Center hosts a calm evening of live jazz.",
    editorialBody: [
      "Downtown Arts Center fills with low conversation before the first set begins.",
      "The jazz series at Downtown Arts Center keeps sets acoustic and unhurried.",
      "Doors open at 6:30 p.m. with tickets listed on the official page below.",
      "Regulars often claim seats near the stage at Downtown Arts Center early.",
      "The room stays intimate enough to hear brushwork on the snare.",
      "Next time you walk past Downtown Arts Center, remember how the lobby lights dim for the downbeat.",
    ],
    ...overrides,
  };
}

const gateContext = {
  now: new Date("2026-07-17T12:00:00Z"),
  editionDate: "2026-07-17",
  eventTimezone: "America/Los_Angeles",
  location: { state: "WA" },
};

Deno.test("gateLocalEventsForPublication removes family-unsafe listings", () => {
  const result = gateLocalEventsForPublication(
    [
      baseEvent(),
      baseEvent({
        name: "Adult Entertainment Expo",
        sourceId: "eventbrite-2",
        sourceUrl: "https://www.eventbrite.com/e/adult-expo-456",
        dateSourceUrl: "https://www.eventbrite.com/e/adult-expo-456",
      }),
    ],
    gateContext
  );

  if (result.events.length !== 1) {
    throw new Error(`expected 1 kept event, got ${result.events.length}`);
  }
  if ((result.report.byReason.family_unsafe ?? 0) < 1) {
    throw new Error("expected family_unsafe rejection");
  }
});

Deno.test("gateLocalEventsForPublication removes events without publishable editorial", () => {
  const result = gateLocalEventsForPublication(
    [
      baseEvent({
        editorialHeadline: null,
        banditNote: null,
        editorialBody: null,
      }),
    ],
    gateContext
  );

  if (result.events.length !== 0) {
    throw new Error("expected unpublishable editorial to be removed");
  }
  if ((result.report.byReason.missing_editorial ?? 0) !== 1) {
    throw new Error("expected missing_editorial rejection");
  }
});

Deno.test("gateDiscoveryPayloadForPublication caps surfaces at See All max", () => {
  const items = Array.from({ length: 30 }, (_, index) => ({
    score: 100 - index,
    surfaces: ["restaurants" as const],
    reasons: [],
    item: {
      id: `place-${index}`,
      title: `Restaurant ${index}`,
      category: "restaurants" as const,
      dek: "Neighborhood favorite",
      editorialConfidence: {
        score: 85,
        action: "publish" as const,
        reasons: [],
      },
    },
  }));

  const payload: DiscoveryPayload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    editionDate: "2026-07-17",
    location: { city: "Seattle", region: "WA", state: "WA", lat: 47.6, lon: -122.3 },
    surfaces: {
      restaurants: {
        surface: "restaurants",
        headline: "Restaurants",
        editorNote: "",
        items,
      },
    },
    picks: [],
    editorBrief: "",
    selectionMeta: {
      candidateCount: items.length,
      selectedCount: items.length,
      editorNotes: [],
      enrichQueue: [],
    },
  };

  const result = gateDiscoveryPayloadForPublication(payload);
  const kept = result.payload.surfaces.restaurants?.items.length ?? 0;
  if (kept !== 20) {
    throw new Error(`expected 20 kept discovery items, got ${kept}`);
  }
});
