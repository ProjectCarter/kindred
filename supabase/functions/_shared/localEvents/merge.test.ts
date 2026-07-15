import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { mergeEventsFromSources } from "./merge.ts";
import type { LocalEvent } from "./provider.ts";

function event(overrides: Partial<LocalEvent> & { name: string }): LocalEvent {
  return {
    startDateTime: "Sat, Jul 18 · 7:00 PM",
    venue: "City Park Amphitheater",
    city: "Gilbert",
    sourceUrl: "https://example.com/event",
    sourceName: "Google Events",
    sourceId: "serp_google_events",
    sourceTier: "aggregator",
    ...overrides,
  };
}

Deno.test("mergeEventsFromSources prefers official source on duplicate", () => {
  const serp = event({
    name: "Summer Concert Series",
    sourceId: "serp_google_events",
    sourceTier: "aggregator",
    imageUrl: null,
  });
  const nps = event({
    name: "Summer Concert Series",
    venue: "City Park Amphitheater",
    sourceId: "nps_park_events",
    sourceTier: "official",
    sourceName: "National Park Service",
    sourceUrl: "https://www.nps.gov/plan-your-visit/event.htm",
    imageUrl: "https://example.com/park.jpg",
  });

  const merged = mergeEventsFromSources([[serp], [nps]]);
  assertEquals(merged.length, 1);
  assertEquals(merged[0]!.sourceId, "nps_park_events");
  assertEquals(merged[0]!.imageUrl, "https://example.com/park.jpg");
});

Deno.test("mergeEventsFromSources keeps distinct events at same venue", () => {
  const a = event({ name: "Jazz Night", startDateTime: "Fri · 8 PM" });
  const b = event({ name: "Comedy Showcase", startDateTime: "Sat · 8 PM" });
  const merged = mergeEventsFromSources([[a, b]]);
  assertEquals(merged.length, 2);
});
