import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  activityContentFingerprint,
  findActivityCatalogDuplicate,
  normalizeActivityName,
  resolveActivityLifecycleAfterImport,
  verifyActivityPlace,
} from "./activitiesCatalog.ts";
import type { NormalizedPlace } from "./types.ts";

function samplePlace(overrides: Partial<NormalizedPlace> = {}): NormalizedPlace {
  return {
    providerId: "fsq-bowling-1",
    name: "Main Event Gilbert",
    category: "bowling",
    address: "1230 N Gilbert Rd",
    city: "Gilbert",
    state: "AZ",
    lat: 33.37,
    lon: -111.79,
    url: "https://example.com/main-event",
    providerCategories: ["Bowling Alley"],
    rating: null,
    priceTier: null,
    note: null,
    ...overrides,
  };
}

Deno.test("verifyActivityPlace accepts in-radius experience venue", () => {
  const result = verifyActivityPlace(samplePlace(), {
    lat: 33.35,
    lon: -111.79,
    city: "Gilbert",
  });
  assertEquals(result.ok, true);
  assertEquals(result.confidence >= 70, true);
});

Deno.test("verifyActivityPlace rejects outside metro radius", () => {
  const result = verifyActivityPlace(
    samplePlace({ lat: 40.7, lon: -74.0 }),
    { lat: 33.35, lon: -111.79, city: "Gilbert" }
  );
  assertEquals(result.ok, false);
  assertEquals(result.reason, "outside_radius");
});

Deno.test("findActivityCatalogDuplicate matches provider id", () => {
  const duplicate = findActivityCatalogDuplicate(samplePlace(), [
    {
      id: "row-1",
      metro_key: "gilbert-az",
      provider: "foursquare",
      provider_id: "fsq-bowling-1",
      provider_category: "bowling",
      name: "Main Event Gilbert",
      normalized_name: normalizeActivityName("Main Event Gilbert"),
      address: null,
      city: "Gilbert",
      state: "AZ",
      lat: 33.37,
      lon: -111.79,
      url: null,
      phone: null,
      opening_hours: null,
      price_level: null,
      provider_categories: [],
      experience_fingerprint: null,
      content_fingerprint: activityContentFingerprint(samplePlace()),
      lifecycle: "active",
      verification_status: "verified",
      confidence_score: 85,
      field_sources: {},
      source_history: [],
      editorial_teaser: null,
      editorial_article: null,
      note: null,
      status: "active",
      rejection_reason: null,
      duplicate_of: null,
      first_seen_at: "2026-07-01T00:00:00.000Z",
      last_verified_at: "2026-07-01T00:00:00.000Z",
      last_material_change_at: null,
    },
  ]);
  assertEquals(duplicate?.id, "row-1");
});

Deno.test("resolveActivityLifecycleAfterImport promotes verified discovery", () => {
  const lifecycle = resolveActivityLifecycleAfterImport({
    current: "discovered",
    confidence: 85,
    passesVerification: true,
    isNewDiscovery: false,
    missingFromFullSync: false,
  });
  assertEquals(lifecycle, "verified");
});

Deno.test("activityContentFingerprint is stable for unchanged place", () => {
  const a = activityContentFingerprint(samplePlace());
  const b = activityContentFingerprint(samplePlace());
  assertEquals(a, b);
});
