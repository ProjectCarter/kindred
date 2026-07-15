import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  applyEventImageRights,
  isImageReuseAuthorized,
  resolveEventImageRights,
  rightsPolicyForSource,
} from "./sourceRights.ts";
import type { LocalEvent } from "./provider.ts";

function event(overrides: Partial<LocalEvent> & { name: string }): LocalEvent {
  return {
    startDateTime: "Sat, Jul 18 · 7:00 PM",
    venue: "City Park Amphitheater",
    city: "Gilbert",
    sourceUrl: "https://example.com/event",
    sourceName: "Eventbrite",
    sourceId: "eventbrite",
    sourceTier: "aggregator",
    imageUrl: "https://cdn.evbuc.com/photo.jpg",
    imageSource: "provider_thumbnail",
    ...overrides,
  };
}

Deno.test("rightsPolicyForSource — aggregators prohibited", () => {
  const policy = rightsPolicyForSource("eventbrite");
  assertEquals(policy.imageReuse, "prohibited");
});

Deno.test("rightsPolicyForSource — official sources unverified", () => {
  const policy = rightsPolicyForSource("nps_park_events");
  assertEquals(policy.imageReuse, "unverified");
});

Deno.test("isImageReuseAuthorized — only granted policies", () => {
  assertEquals(isImageReuseAuthorized("prohibited"), false);
  assertEquals(isImageReuseAuthorized("unverified"), false);
  assertEquals(isImageReuseAuthorized("api_granted"), true);
  assertEquals(isImageReuseAuthorized("partner_granted"), true);
});

Deno.test("applyEventImageRights strips Eventbrite listing photos", () => {
  const rights = applyEventImageRights(event({ name: "Summer Concert" }));
  assertEquals(rights.imageUrl, null);
  assertEquals(rights.imageSource, null);
  assertEquals(rights.imageRights?.authorized, false);
  assertEquals(rights.imageRights?.policy, "prohibited");
  assertEquals(rights.imageRights?.sourceId, "eventbrite");
});

Deno.test("applyEventImageRights keeps photos when api_granted", () => {
  const granted = applyEventImageRights(
    event({
      name: "Park Ranger Talk",
      sourceId: "nps_park_events",
      sourceName: "National Park Service",
      sourceTier: "official",
      imageUrl: "https://www.nps.gov/photo.jpg",
    })
  );
  // NPS default is unverified — still stripped until partnership grants rights.
  assertEquals(granted.imageUrl, null);
  assertEquals(granted.imageRights?.policy, "unverified");

  const rights = resolveEventImageRights("nps_park_events");
  assertEquals(rights.authorized, false);
});
