import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  contentFingerprint,
  dealKeyFor,
  isPublishableDeal,
  normalizeMerchant,
  normalizeRedeemUrl,
  stableUuid,
  toPublishedRow,
} from "./publish.ts";
import type { NormalizedDeal } from "./types.ts";

function deal(overrides: Partial<NormalizedDeal> = {}): NormalizedDeal {
  return {
    provider: "awin",
    providerId: "PROMO-1",
    scope: "online",
    category: "shopping",
    merchant: "Example Shop",
    title: "20% off everything",
    savingsLabel: "20% off",
    description: "A storewide discount.",
    redeemUrl: "https://tidd.ly/example",
    ...overrides,
  };
}

Deno.test("normalizeRedeemUrl keeps http(s) verbatim, rejects others", () => {
  assertEquals(normalizeRedeemUrl(" https://tidd.ly/x "), "https://tidd.ly/x");
  assertEquals(normalizeRedeemUrl("http://a.com"), "http://a.com");
  assertEquals(normalizeRedeemUrl("javascript:alert(1)"), null);
  assertEquals(normalizeRedeemUrl("ftp://a.com"), null);
  assertEquals(normalizeRedeemUrl(""), null);
  assertEquals(normalizeRedeemUrl(null), null);
});

Deno.test("normalizeMerchant lowercases and collapses to single spaces", () => {
  assertEquals(normalizeMerchant("Extranomical  Tours!"), "extranomical tours");
});

Deno.test("dealKeyFor is stable and slugified", () => {
  const key = dealKeyFor(deal({ merchant: "Extranomical Tours", providerId: "P 12" }));
  assertEquals(key, "awin-extranomical-tours-p-12");
});

Deno.test("stableUuid is deterministic and RFC-4122 shaped", () => {
  const a = stableUuid("awin-example-shop-promo-1");
  const b = stableUuid("awin-example-shop-promo-1");
  assertEquals(a, b);
  assert(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(a));
});

Deno.test("contentFingerprint changes when the offer changes", () => {
  const base = contentFingerprint(deal());
  const changed = contentFingerprint(deal({ title: "30% off everything" }));
  assert(base !== changed);
});

Deno.test("isPublishableDeal keeps a valid offer", () => {
  assertEquals(isPublishableDeal(deal()), true);
});

Deno.test("isPublishableDeal drops offers with no valid redeem URL", () => {
  assertEquals(isPublishableDeal(deal({ redeemUrl: null })), false);
  assertEquals(isPublishableDeal(deal({ redeemUrl: "not-a-url" })), false);
});

Deno.test("isPublishableDeal drops restricted / weapons offers (safety gate)", () => {
  assertEquals(
    isPublishableDeal(
      deal({ merchant: "Desert Eagle Gun Shop", title: "Firearms training course" })
    ),
    false
  );
  assertEquals(
    isPublishableDeal(deal({ merchant: "CCW Permit Class", title: "Concealed carry class" })),
    false
  );
});

Deno.test("isPublishableDeal drops offers missing merchant or title", () => {
  assertEquals(isPublishableDeal(deal({ merchant: "" })), false);
  assertEquals(isPublishableDeal(deal({ title: "" })), false);
});

Deno.test("toPublishedRow fills required non-null fields and resolves emoji", () => {
  const row = toPublishedRow(
    deal({ category: "travel_transportation", scope: "nationwide", metroKey: null })
  ) as Record<string, unknown>;
  assertEquals(row.deal_key, "awin-example-shop-promo-1");
  assertEquals(row.scope, "nationwide");
  assertEquals(row.category, "travel_transportation");
  assertEquals(row.emoji, "✈️");
  assertEquals(row.status, "published");
  assertEquals(row.source, "AWIN");
  // Required-non-null columns must never be empty.
  assert(typeof row.savings_label === "string" && (row.savings_label as string).length > 0);
  assert(typeof row.description === "string" && (row.description as string).length > 0);
  assertEquals(row.savings_detail, "");
  // Redeem URL preserved verbatim; no photo in V1.
  assertEquals(row.redeem_url, "https://tidd.ly/example");
  assertEquals(row.image_url, null);
});

Deno.test("toPublishedRow coerces an unknown category to a safe default", () => {
  const row = toPublishedRow(deal({ category: "totally_unknown" })) as Record<string, unknown>;
  assertEquals(row.category, "things_to_do");
  assertEquals(row.emoji, "🎟️");
});

Deno.test("toPublishedRow falls back to title when description is blank", () => {
  const row = toPublishedRow(deal({ description: "   " })) as Record<string, unknown>;
  assertEquals(row.description, "20% off everything");
});
