import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createBudgetTracker,
  isProviderDisabled,
  loadCatalogSyncBudget,
  recordApiCalls,
} from "../editorial/catalogSyncBudget.ts";
import {
  eventContentFingerprint,
  eventDedupeKey,
  extractEventProviderId,
  findEventCatalogDuplicate,
  resolveEventCatalogLifecycle,
  type EventsCatalogRow,
} from "./eventsCatalog.ts";
import type { LocalEvent } from "./provider.ts";

function sampleEvent(overrides: Partial<LocalEvent> = {}): LocalEvent {
  return {
    name: "Jazz Night",
    startDateTime: "Sat, Jul 18 · 7:00 PM",
    startDateIso: "2026-07-18",
    venue: "Downtown Theater",
    city: "Gilbert",
    sourceUrl: "https://www.eventbrite.com/e/jazz-night-123456789",
    sourceName: "Eventbrite",
    sourceId: "eventbrite",
    dateVerification: {
      verifiedStartDateTime: "2026-07-18T19:00:00",
      verifiedEndDateTime: null,
      eventTimezone: "America/Phoenix",
      dateSourceUrl: "https://www.eventbrite.com/e/jazz-night-123456789",
      dateSourceType: "official_ticketing_page",
      verifiedAt: "2026-07-17T00:00:00.000Z",
      verificationStatus: "verified",
      rejectionReason: null,
    },
    dateSourceType: "official_ticketing_page",
    ...overrides,
  };
}

Deno.test("eventDedupeKey uses name venue and schedule", () => {
  const key = eventDedupeKey(sampleEvent());
  assertEquals(key.includes("jazz night"), true);
  assertEquals(key.includes("downtown theater"), true);
});

Deno.test("extractEventProviderId parses Eventbrite id", () => {
  const id = extractEventProviderId(sampleEvent());
  assertEquals(id, "eb:123456789");
});

Deno.test("eventContentFingerprint changes when schedule changes", () => {
  const a = eventContentFingerprint(sampleEvent());
  const b = eventContentFingerprint(
    sampleEvent({ startDateTime: "Sun, Jul 19 · 7:00 PM" })
  );
  assertEquals(a === b, false);
});

Deno.test("findEventCatalogDuplicate matches dedupe key across providers", () => {
  const event = sampleEvent({ sourceId: "ticketmaster" });
  const rows: EventsCatalogRow[] = [
    {
      id: "row-1",
      metro_key: "gilbert-az",
      provider: "eventbrite",
      provider_id: "eb:123456789",
      dedupe_key: eventDedupeKey(event),
      name: event.name,
      editorial_title: null,
      venue: event.venue,
      city: event.city,
      address: null,
      lat: null,
      lon: null,
      start_at: null,
      end_at: null,
      event_timezone: null,
      official_website: null,
      ticket_url: null,
      content_fingerprint: eventContentFingerprint(event),
      lifecycle: "upcoming",
      verification_status: "verified",
      verification_confidence: 90,
      event_payload: event,
      editorial_teaser: null,
      editorial_body: null,
      source_history: [],
      image_source: null,
      image_license: null,
      duplicate_of: null,
      first_seen_at: "2026-07-01T00:00:00.000Z",
      last_verified_at: "2026-07-01T00:00:00.000Z",
      last_material_change_at: null,
    },
  ];
  const duplicate = findEventCatalogDuplicate(event, rows);
  assertEquals(duplicate?.id, "row-1");
});

Deno.test("resolveEventCatalogLifecycle marks future events upcoming", () => {
  const lifecycle = resolveEventCatalogLifecycle(
    sampleEvent({ startDateIso: "2026-12-25" }),
    { lat: 33.35, lon: -111.79, city: "Gilbert", state: "AZ" },
    new Date("2026-07-17T12:00:00.000Z"),
    true
  );
  assertEquals(lifecycle, "upcoming");
});

Deno.test("catalog budget aborts after max calls", () => {
  const budget = { ...loadCatalogSyncBudget(), maxCallsPerRun: 2 };
  const tracker = createBudgetTracker();
  assertEquals(recordApiCalls(tracker, budget, 1), true);
  assertEquals(recordApiCalls(tracker, budget, 1), true);
  assertEquals(recordApiCalls(tracker, budget, 1), false);
  assertEquals(tracker.aborted, true);
});

Deno.test("isProviderDisabled respects env flag", () => {
  const prev = Deno.env.get("TICKETMASTER_DISABLED");
  Deno.env.set("TICKETMASTER_DISABLED", "true");
  assertEquals(isProviderDisabled("ticketmaster"), true);
  if (prev === undefined) Deno.env.delete("TICKETMASTER_DISABLED");
  else Deno.env.set("TICKETMASTER_DISABLED", prev);
});
