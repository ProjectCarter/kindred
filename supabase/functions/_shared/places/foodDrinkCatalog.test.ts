import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  catalogContentFingerprint,
  findCatalogDuplicate,
  normalizeCatalogName,
  placeWithinMetroRadius,
  verifyFoodDrinkPlace,
  type FoodDrinkCatalogRow,
} from "./foodDrinkCatalog.ts";
import type { NormalizedPlace } from "./types.ts";

function samplePlace(overrides: Partial<NormalizedPlace> = {}): NormalizedPlace {
  return {
    providerId: "fsq-abc",
    name: "Joe's Coffee",
    category: "coffee",
    address: "123 Main St",
    city: "Gilbert",
    state: "AZ",
    lat: 33.3528,
    lon: -111.789,
    url: "https://example.com/joes",
    providerCategories: ["Coffee Shop"],
    rating: null,
    priceTier: null,
    note: null,
    ...overrides,
  };
}

function sampleRow(overrides: Partial<FoodDrinkCatalogRow> = {}): FoodDrinkCatalogRow {
  const place = samplePlace();
  return {
    id: "row-1",
    metro_key: "gilbert-az",
    provider: "foursquare",
    provider_id: place.providerId,
    provider_category: place.category,
    name: place.name,
    normalized_name: normalizeCatalogName(place.name),
    address: place.address,
    city: place.city,
    state: place.state,
    lat: place.lat,
    lon: place.lon,
    url: place.url,
    provider_categories: place.providerCategories,
    note: null,
    content_fingerprint: catalogContentFingerprint(place),
    status: "active",
    lifecycle: "verified",
    confidence_score: 75,
    verification_status: "verified",
    field_sources: {},
    source_history: [],
    phone: null,
    cuisine: null,
    editorial_categories: [],
    editorial_tags: [],
    editorial_teaser: null,
    editorial_article: null,
    opening_hours: null,
    price_level: null,
    photos: [],
    editorial_override_history: [],
  editorial_score: 75,
  editorial_labels: [],
  editorial_reason: null,
  editorial_score_version: 1,
  editorial_scored_at: null,
  editorial_score_evidence: {},
  editorial_score_previous: null,
  editorial_score_change_reason: null,
  editorial_score_material_fingerprint: null,
  editorial_lock: false,
  editorial_score_override: null,
  editorial_labels_override: null,
  editorial_reason_override: null,
  override_author: null,
  override_timestamp: null,
  rejection_reason: null,
    duplicate_of: null,
    first_seen_at: "2026-01-01T00:00:00Z",
    last_verified_at: "2026-01-01T00:00:00Z",
    discovered_at: null,
    editorial_note_at: null,
    ...overrides,
  };
}

Deno.test("normalizeCatalogName collapses punctuation and spacing", () => {
  assertEquals(normalizeCatalogName("Joe's Coffee & Tea!"), "joe s coffee tea");
});

Deno.test("catalogContentFingerprint changes when material fields change", () => {
  const base = samplePlace();
  const moved = samplePlace({ lat: 33.36 });
  assertEquals(
    catalogContentFingerprint(base) === catalogContentFingerprint(moved),
    false
  );
});

Deno.test("verifyFoodDrinkPlace rejects venues outside metro radius", () => {
  const far = samplePlace({ lat: 34.5, lon: -112.5 });
  const result = verifyFoodDrinkPlace(far, { lat: 33.3528, lon: -111.789 });
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.reason, "outside_radius");
});

Deno.test("verifyFoodDrinkPlace accepts a valid in-radius restaurant", () => {
  const place = samplePlace({ category: "restaurants" });
  const result = verifyFoodDrinkPlace(place, { lat: 33.3528, lon: -111.789 });
  assertEquals(result.ok, true);
});

Deno.test("placeWithinMetroRadius respects Kindred local radius", () => {
  const metro = { lat: 33.3528, lon: -111.789 };
  assertEquals(placeWithinMetroRadius(samplePlace(), metro), true);
  assertEquals(
    placeWithinMetroRadius(samplePlace({ lat: 35, lon: -111.789 }), metro),
    false
  );
});

Deno.test("findCatalogDuplicate matches normalized name and proximity", () => {
  const existing = [sampleRow({ provider_id: "fsq-old", id: "existing-1" })];
  const candidate = samplePlace({
    providerId: "fsq-new",
    name: "Joe's Coffee",
    lat: 33.3529,
    lon: -111.7891,
  });
  const dup = findCatalogDuplicate(candidate, existing);
  assertEquals(dup?.id, "existing-1");
});

Deno.test("findCatalogDuplicate matches shared website when names align", () => {
  const existing = [
    sampleRow({
      provider_id: "fsq-old",
      id: "existing-2",
      normalized_name: "desert eagle brewing",
      name: "Desert Eagle Brewing",
      url: "https://deserteaglebrewing.com/",
    }),
  ];
  const candidate = samplePlace({
    providerId: "fsq-new",
    name: "Desert Eagle Brewing",
    category: "restaurants",
    url: "https://www.deserteaglebrewing.com",
    lat: 33.4,
    lon: -111.8,
  });
  const dup = findCatalogDuplicate(candidate, existing);
  assertEquals(dup?.id, "existing-2");
});
