import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  AWIN_MANUAL_OFFERS,
  buildPromotionsBody,
  categoryForSector,
  createAwinConnector,
  mapAwinProgramme,
  mapAwinPromotionToDeal,
  type AwinProgramme,
} from "./awin.ts";

// A docs-shaped Awin promotion (untrusted external JSON).
const PROGRAMME_RAW = {
  id: 3,
  name: "Extranomical Tours",
  primarySector: "Travel & Leisure",
  primaryRegion: { countryCode: "US", name: "United States" },
  clickThroughUrl: "https://www.awin1.com/cread.php?awinmid=3&awinaffid=999",
};

function programmesMap(): Map<number, AwinProgramme> {
  const map = new Map<number, AwinProgramme>();
  const p = mapAwinProgramme(PROGRAMME_RAW);
  if (p) map.set(p.id, p);
  return map;
}

Deno.test("mapAwinProgramme reads the fields we use", () => {
  const p = mapAwinProgramme(PROGRAMME_RAW);
  assert(p);
  assertEquals(p?.id, 3);
  assertEquals(p?.name, "Extranomical Tours");
  assertEquals(p?.primaryRegionCode, "US");
  assertEquals(p?.primarySector, "Travel & Leisure");
});

Deno.test("mapAwinProgramme rejects records without id or name", () => {
  assertEquals(mapAwinProgramme({ name: "No id" }), null);
  assertEquals(mapAwinProgramme({ id: 5 }), null);
  assertEquals(mapAwinProgramme(null), null);
});

Deno.test("categoryForSector maps travel to a travel category, unknown to shopping", () => {
  assertEquals(categoryForSector("Travel & Leisure"), "travel_transportation");
  assertEquals(categoryForSector("Accommodation"), "hotels_staycations");
  assertEquals(categoryForSector("Something New"), "shopping");
  assertEquals(categoryForSector(null), "shopping");
});

Deno.test("mapAwinPromotionToDeal maps a promotion and preserves the tracking URL verbatim", () => {
  const raw = {
    promotionId: "PROMO-123",
    advertiserId: 3,
    title: "10% off guided tours",
    description: "Save on the guided Alcatraz and city tour.",
    terms: "New customers only.",
    urlTracking: "https://tidd.ly/abc123",
    startDate: "2026-08-01T00:00:00Z",
    endDate: "2026-12-31T00:00:00Z",
    voucher: { code: "SAVE10" },
  };
  const deal = mapAwinPromotionToDeal(raw, programmesMap());
  assert(deal);
  assertEquals(deal?.provider, "awin");
  assertEquals(deal?.providerId, "PROMO-123");
  assertEquals(deal?.merchant, "Extranomical Tours");
  assertEquals(deal?.title, "10% off guided tours");
  // Verbatim — never rebuilt or appended.
  assertEquals(deal?.redeemUrl, "https://tidd.ly/abc123");
  assertEquals(deal?.voucherCode, "SAVE10");
  assertEquals(deal?.savingsLabel, "Voucher code");
  assertEquals(deal?.category, "travel_transportation");
  // Travel sector → nationwide raw scope (never local; no metro guessing).
  assertEquals(deal?.scope, "nationwide");
  assertEquals(deal?.endsAt, "2026-12-31T00:00:00Z");
});

Deno.test("mapAwinPromotionToDeal drops a promotion with no tracking URL (never fabricates)", () => {
  const raw = {
    promotionId: "PROMO-404",
    advertiserId: 3,
    title: "Mystery offer",
  };
  assertEquals(mapAwinPromotionToDeal(raw, programmesMap()), null);
});

Deno.test("mapAwinPromotionToDeal drops a promotion with no resolvable merchant", () => {
  const raw = {
    promotionId: "PROMO-500",
    advertiserId: 999, // not in programmes map, no advertiser object
    title: "Orphan offer",
    urlTracking: "https://tidd.ly/orphan",
  };
  assertEquals(mapAwinPromotionToDeal(raw, programmesMap()), null);
});

Deno.test("buildPromotionsBody targets joined + active + US with pagination", () => {
  const body = buildPromotionsBody(2) as {
    filters: Record<string, unknown>;
    pagination: Record<string, unknown>;
  };
  assertEquals(body.filters.membership, "joined");
  assertEquals(body.filters.status, "active");
  assertEquals(body.pagination.page, 2);
});

Deno.test("connector is inert when there are no manual offers and no secrets", async () => {
  // No AWIN_* env in the test runner and the curated seed ships empty.
  assertEquals(AWIN_MANUAL_OFFERS.length, 0);
  const connector = createAwinConnector();
  assertEquals(connector.id, "awin");
  assertEquals(connector.isConfigured, false);
  const deals = await connector.fetch();
  assertEquals(deals.length, 0);
});
