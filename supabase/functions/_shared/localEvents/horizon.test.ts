import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  classifyEventHorizon,
  parseEventStartDate,
  resolveEventHorizon,
  EVENT_HORIZON_DAYS,
} from "./horizon.ts";
import type { LocalEvent } from "./provider.ts";

const EDITION_DAY = new Date(2026, 6, 15); // Wed Jul 15, 2026

Deno.test("parseEventStartDate handles ISO and month-day strings", () => {
  assertEquals(
    parseEventStartDate("ignored", "2026-07-18", EDITION_DAY)?.getDate(),
    18
  );
  const parsed = parseEventStartDate("Sat, Jul 18, 7 PM", null, EDITION_DAY);
  assertEquals(parsed?.getMonth(), 6);
  assertEquals(parsed?.getDate(), 18);
});

Deno.test("classifyEventHorizon buckets this and next weekend from edition day", () => {
  const thisWeekend = new Date(2026, 6, 18); // Sat
  const nextWeekend = new Date(2026, 6, 25); // next Sat
  const comingSoon = new Date(2026, 7, 5); // Aug 5
  assertEquals(classifyEventHorizon(thisWeekend, EDITION_DAY), "this_weekend");
  assertEquals(classifyEventHorizon(nextWeekend, EDITION_DAY), "next_weekend");
  assertEquals(classifyEventHorizon(comingSoon, EDITION_DAY), "coming_soon");
});

Deno.test("events beyond 30 days are excluded", () => {
  const far = new Date(EDITION_DAY);
  far.setDate(far.getDate() + EVENT_HORIZON_DAYS + 3);
  assertEquals(classifyEventHorizon(far, EDITION_DAY), "beyond");
});

Deno.test("resolveEventHorizon attaches bucket on event record", () => {
  const event: LocalEvent = {
    name: "Summer Concert",
    startDateTime: "Sat, Jul 18, 7 PM",
    venue: "Downtown Park",
    city: "Gilbert",
    sourceUrl: "https://example.com/tickets",
    sourceName: "Listing",
  };
  const bucket = resolveEventHorizon(event, EDITION_DAY);
  assertEquals(bucket, "this_weekend");
});
