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
    startDateTime: "2026-07-20T19:00:00",
    sourceUrl: "https://example.com/jazz",
    sourceName: "Eventbrite",
    sourceId: "evt-1",
    editorialHeadline: "Jazz returns to the arts center",
    banditNote: "A calm evening of live music downtown.",
    editorialBody: [
      "The arts center hosts an evening of local jazz.",
      "Doors open at 6:30 p.m.",
      "Tickets remain available through the official listing.",
    ],
    dateVerification: {
      verificationStatus: "verified",
      verifiedAt: "2026-07-17T00:00:00.000Z",
      rejectionReason: null,
    },
    ...overrides,
  };
}

Deno.test("gateLocalEventsForPublication removes family-unsafe listings", () => {
  const result = gateLocalEventsForPublication(
    [
      baseEvent(),
      baseEvent({
        name: "Adult Entertainment Expo",
        sourceId: "evt-2",
      }),
    ],
    {
      now: new Date("2026-07-17T12:00:00Z"),
      editionDate: "2026-07-17",
      eventTimezone: "America/Los_Angeles",
      location: { city: "Seattle", state: "WA", lat: 47.6, lon: -122.3 },
    }
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
    {
      now: new Date("2026-07-17T12:00:00Z"),
      editionDate: "2026-07-17",
      eventTimezone: "America/Los_Angeles",
      location: { city: "Seattle", state: "WA", lat: 47.6, lon: -122.3 },
    }
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
    surfaces: {
      restaurants: {
        surface: "restaurants",
        items,
      },
    },
    picks: [],
    selectionMeta: {
      selectedCount: items.length,
      enrichQueue: [],
    },
  };

  const result = gateDiscoveryPayloadForPublication(payload);
  const kept = result.payload.surfaces.restaurants?.items.length ?? 0;
  if (kept !== 20) {
    throw new Error(`expected 20 kept discovery items, got ${kept}`);
  }
});
