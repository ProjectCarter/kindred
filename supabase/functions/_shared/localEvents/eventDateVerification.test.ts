import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  filterVerifiedEventsForEdition,
  verifyEventDate,
} from "./eventDateVerification.ts";
import type { LocalEvent } from "./provider.ts";
import { mergeEventsFromSources } from "./merge.ts";

const PHOENIX = "America/Phoenix";

function baseEvent(overrides: Partial<LocalEvent> = {}): LocalEvent {
  return {
    name: "Summer Concert in the Park",
    startDateTime: "Jul 20, 2026 · 7:00 PM",
    startDateIso: "2026-07-20",
    startTimeIso: "19:00",
    venue: "Freestone Park",
    city: "Gilbert",
    sourceUrl: "https://www.eventbrite.com/e/summer-concert-123",
    sourceName: "Eventbrite",
    sourceId: "eventbrite",
    sourceTier: "aggregator",
    dateSourceType: "official_ticketing_page",
    dateSourceUrl: "https://www.eventbrite.com/e/summer-concert-123",
    officialWebsite: "https://www.gilbertaz.gov/events",
    ...overrides,
  };
}

Deno.test("verifyEventDate accepts a future ticketing event with explicit year", () => {
  const now = new Date("2026-07-16T15:00:00-07:00");
  const result = verifyEventDate(baseEvent(), {
    now,
    location: { state: "AZ" },
    eventTimezone: PHOENIX,
  });
  assertEquals(result.verificationStatus, "verified");
  assertExists(result.verifiedStartDateTime);
  assertEquals(result.eventTimezone, PHOENIX);
  assertEquals(result.rejectionReason, null);
});

Deno.test("verifyEventDate rejects event whose end time already passed", () => {
  const now = new Date("2026-07-16T22:00:00-07:00");
  const result = verifyEventDate(
    baseEvent({
      startDateIso: "2026-07-16",
      startTimeIso: "18:00",
      endTimeIso: "20:00",
      startDateTime: "Jul 16, 2026 · 6:00 PM – 8:00 PM",
    }),
    { now, location: { state: "AZ" }, eventTimezone: PHOENIX }
  );
  assertEquals(result.verificationStatus, "rejected");
  assertEquals(result.rejectionReason, "expired_end_before_now");
});

Deno.test("verifyEventDate rejects timed start in the past when no end exists", () => {
  const now = new Date("2026-07-16T21:00:00-07:00");
  const result = verifyEventDate(
    baseEvent({
      startDateIso: "2026-07-16",
      startTimeIso: "19:00",
      startDateTime: "Jul 16, 2026 · 7:00 PM",
    }),
    { now, location: { state: "AZ" }, eventTimezone: PHOENIX }
  );
  assertEquals(result.rejectionReason, "expired_start_before_now");
});

Deno.test("verifyEventDate keeps all-day events active through 11:59:59 PM local", () => {
  const now = new Date("2026-07-16T20:00:00-07:00");
  const result = verifyEventDate(
    baseEvent({
      startDateIso: "2026-07-16",
      startTimeIso: null,
      startDateTime: "Jul 16, 2026",
    }),
    { now, location: { state: "AZ" }, eventTimezone: PHOENIX }
  );
  assertEquals(result.verificationStatus, "verified");
  assertExists(result.verifiedEndDateTime);
});

Deno.test("verifyEventDate rejects all-day events after local midnight", () => {
  const now = new Date("2026-07-17T00:05:00-07:00");
  const result = verifyEventDate(
    baseEvent({
      startDateIso: "2026-07-16",
      startTimeIso: null,
      startDateTime: "Jul 16, 2026",
    }),
    { now, location: { state: "AZ" }, eventTimezone: PHOENIX }
  );
  assertEquals(result.rejectionReason, "expired_end_before_now");
});

Deno.test("verifyEventDate rejects events beyond 30 days", () => {
  const now = new Date("2026-07-16T12:00:00-07:00");
  const result = verifyEventDate(
    baseEvent({
      startDateIso: "2026-08-20",
      startDateTime: "Aug 20, 2026 · 7:00 PM",
    }),
    { now, location: { state: "AZ" }, eventTimezone: PHOENIX }
  );
  assertEquals(result.rejectionReason, "beyond_horizon");
});

Deno.test("verifyEventDate rejects inferred year without explicit year", () => {
  const now = new Date("2026-07-16T12:00:00-07:00");
  const result = verifyEventDate(
    baseEvent({
      startDateIso: null,
      startDateTime: "Sat, Jul 18, 7 PM",
    }),
    { now, location: { state: "AZ" }, eventTimezone: PHOENIX }
  );
  assertEquals(result.rejectionReason, "inferred_year");
});

Deno.test("verifyEventDate rejects ambiguous schedules", () => {
  const now = new Date("2026-07-16T12:00:00-07:00");
  const result = verifyEventDate(
    baseEvent({
      startDateIso: null,
      startDateTime: "This week",
    }),
    { now, location: { state: "AZ" }, eventTimezone: PHOENIX }
  );
  assertEquals(result.rejectionReason, "missing_start_datetime");
});

Deno.test("verifyEventDate rejects cancelled and registration-closed listings", () => {
  const now = new Date("2026-07-16T12:00:00-07:00");
  const cancelled = verifyEventDate(
    baseEvent({ name: "Jazz Night — CANCELLED" }),
    { now, location: { state: "AZ" }, eventTimezone: PHOENIX }
  );
  assertEquals(cancelled.rejectionReason, "cancelled");

  const closed = verifyEventDate(
    baseEvent({ startDateTime: "Jul 20, 2026 · 7:00 PM — registration closed" }),
    { now, location: { state: "AZ" }, eventTimezone: PHOENIX }
  );
  assertEquals(closed.rejectionReason, "registration_closed");
});

Deno.test("verifyEventDate rejects secondary listings without official corroboration", () => {
  const now = new Date("2026-07-16T12:00:00-07:00");
  const result = verifyEventDate(
    baseEvent({
      sourceId: "serp_google_events",
      dateSourceType: "trusted_secondary_listing",
      officialWebsite: null,
      sourceUrl: "https://google.com/events/example",
    }),
    { now, location: { state: "AZ" }, eventTimezone: PHOENIX }
  );
  assertEquals(result.rejectionReason, "secondary_unverified");
});

Deno.test("verifyEventDate rejects forbidden publication timestamps as event dates", () => {
  const now = new Date("2026-07-16T12:00:00-07:00");
  const result = verifyEventDate(
    baseEvent({
      startDateIso: "2026-07-20",
      startDateTime: "Published on Jul 20, 2026",
    }),
    { now, location: { state: "AZ" }, eventTimezone: PHOENIX }
  );
  assertEquals(result.rejectionReason, "forbidden_date_source");
});

Deno.test("verifyEventDate rejects generic recurring listings without a concrete occurrence", () => {
  const now = new Date("2026-07-16T12:00:00-07:00");
  const result = verifyEventDate(
    baseEvent({
      name: "Farmers Market — every Saturday",
      startDateIso: null,
      startDateTime: "Every Saturday morning",
    }),
    { now, location: { state: "AZ" }, eventTimezone: PHOENIX }
  );
  assertEquals(result.rejectionReason, "recurring_no_occurrence");
});

Deno.test("mergeEventsFromSources flags conflicting dates across sources", () => {
  const official = baseEvent({
    sourceId: "nps_park_events",
    sourceTier: "official",
    startDateIso: "2026-07-18",
    startDateTime: "2026-07-18",
    dateSourceType: "official_organizer_page",
  });
  const secondary = baseEvent({
    sourceId: "serp_google_events",
    startDateIso: "2026-07-20",
    startDateTime: "Jul 20, 2026",
    dateSourceType: "trusted_secondary_listing",
  });
  const merged = mergeEventsFromSources([[official], [secondary]]);
  assertEquals(merged.length, 1);
  assertEquals(merged[0].dateSourceConflict, true);

  const verified = verifyEventDate(merged[0], {
    now: new Date("2026-07-16T12:00:00-07:00"),
    location: { state: "AZ" },
    eventTimezone: PHOENIX,
  });
  assertEquals(verified.rejectionReason, "source_date_conflict");
});

Deno.test("filterVerifiedEventsForEdition drops expired events from publish pool", () => {
  const now = new Date("2026-07-16T21:00:00-07:00");
  const { verified, rejected } = filterVerifiedEventsForEdition(
    [
      baseEvent({
        startDateIso: "2026-07-16",
        startTimeIso: "19:00",
        startDateTime: "Jul 16, 2026 · 7:00 PM",
      }),
      baseEvent({
        name: "Future Night Market",
        startDateIso: "2026-07-22",
        startTimeIso: "18:00",
        startDateTime: "Jul 22, 2026 · 6:00 PM",
      }),
    ],
    { now, location: { state: "AZ" }, eventTimezone: PHOENIX }
  );
  assertEquals(verified.length, 1);
  assertEquals(verified[0].name, "Future Night Market");
  assertEquals(rejected.length, 1);
  assertEquals(rejected[0].reason, "expired_start_before_now");
});
