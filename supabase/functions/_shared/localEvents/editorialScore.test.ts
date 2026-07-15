import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { computeKindredEventEditorialScore } from "./editorialScore.ts";
import type { LocalEvent } from "./provider.ts";

const EDITION_DAY = new Date(2026, 6, 15);

function baseEvent(overrides: Partial<LocalEvent> = {}): LocalEvent {
  return {
    name: "Summer Concert in the Park",
    startDateTime: "Sat, Jul 18, 7 PM",
    startDateIso: "2026-07-18",
    venue: "Freestone Park",
    city: "Gilbert",
    sourceUrl: "https://eventbrite.com/e/example",
    sourceName: "Eventbrite",
    category: "music",
    ...overrides,
  };
}

Deno.test("experience-first events score higher than networking", () => {
  const concert = computeKindredEventEditorialScore(baseEvent(), { now: EDITION_DAY });
  const networking = computeKindredEventEditorialScore(
    baseEvent({
      name: "The Women 360 Networking and Business Development Event",
      category: "community",
      venue: "Gilbert Office Park",
    }),
    { now: EDITION_DAY }
  );
  assertEquals(concert.total > networking.total, true);
});

Deno.test("car show and festival patterns boost worth-leaving-house", () => {
  const carShow = computeKindredEventEditorialScore(
    baseEvent({
      name: "4th Annual Carz & Kickz",
      category: "community",
      startDateIso: "2026-08-15",
      startDateTime: "Sat, Aug 15, 11 AM",
    }),
    { now: EDITION_DAY }
  );
  assertEquals(carShow.dimensions.worthLeavingHouse > 0, true);
});

Deno.test("events beyond horizon receive timeliness penalty", () => {
  const far = computeKindredEventEditorialScore(
    baseEvent({
      startDateIso: "2026-09-20",
      startDateTime: "Sat, Sep 20, 7 PM",
    }),
    { now: EDITION_DAY, horizonBucket: "beyond" }
  );
  assertEquals(far.dimensions.timeliness < 0, true);
});

Deno.test("local Gilbert venue scores higher on local relevance", () => {
  const local = computeKindredEventEditorialScore(baseEvent(), {
    now: EDITION_DAY,
    readerCity: "Gilbert",
  });
  const distant = computeKindredEventEditorialScore(
    baseEvent({ city: "Los Angeles", venue: "LA Convention Center" }),
    { now: EDITION_DAY, readerCity: "Gilbert" }
  );
  assertEquals(local.dimensions.localRelevance >= distant.dimensions.localRelevance, true);
});
