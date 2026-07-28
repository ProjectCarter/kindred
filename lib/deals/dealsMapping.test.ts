import { test } from "node:test";
import assert from "node:assert/strict";
import { mapPublishedDeal, type PublishedDealRow } from "./localDeals.ts";

function row(overrides: Partial<PublishedDealRow> = {}): PublishedDealRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    deal_key: "la-milpa-bogo",
    scope: "local",
    region_key: "gilbert-az",
    category: "restaurants",
    deal_type: "restaurant",
    discount_type: "bogo",
    emoji: "🌮",
    merchant: "La Milpa Taqueria",
    title: "Buy One Get One Tacos",
    savings_label: "BOGO",
    description: "A neighborhood taqueria worth the trip.",
    savings_detail: "Buy one taco plate, get one free.",
    known_for: "Handmade tortillas and slow-braised carnitas.",
    highlights: ["Family owned", "Cash or card"],
    city: "Gilbert, AZ",
    state: "AZ",
    lat: 33.35,
    lon: -111.79,
    website: "https://example.com",
    redeem_url: "https://affiliate.example.com/redeem",
    source: "Direct Merchant",
    terms: "Dine-in only.",
    voucher_code: null,
    image_url: null,
    featured_rank: 1,
    quality_score: 0.9,
    starts_at: null,
    ends_at: "2099-01-01T00:00:00Z",
    ...overrides,
  };
}

test("maps deal_key to the public id", () => {
  assert.equal(mapPublishedDeal(row()).id, "la-milpa-bogo");
});

test("keeps a known category and its scope", () => {
  const deal = mapPublishedDeal(row());
  assert.equal(deal.category, "restaurants");
  assert.equal(deal.scope, "local");
  assert.equal(deal.source, "Direct Merchant");
  assert.equal(deal.redeemUrl, "https://affiliate.example.com/redeem");
});

test("unknown category falls back to things_to_do", () => {
  const deal = mapPublishedDeal(row({ category: "spaceships" }));
  assert.equal(deal.category, "things_to_do");
});

test("emoji falls back to the category emoji when blank", () => {
  const deal = mapPublishedDeal(row({ emoji: "  ", category: "restaurants" }));
  assert.equal(deal.emoji, "🍽️");
});

test("parses highlights array and drops empties", () => {
  const deal = mapPublishedDeal(
    row({ highlights: ["Free parking", "  ", 7, null] as unknown[] })
  );
  assert.deepEqual(deal.highlights, ["Free parking"]);
});

test("non-array highlights become undefined", () => {
  assert.equal(mapPublishedDeal(row({ highlights: null })).highlights, undefined);
  assert.equal(mapPublishedDeal(row({ highlights: "nope" })).highlights, undefined);
});

test("normalizes an unexpected scope to local", () => {
  assert.equal(mapPublishedDeal(row({ scope: "galactic" })).scope, "local");
  assert.equal(mapPublishedDeal(row({ scope: "online" })).scope, "online");
  assert.equal(mapPublishedDeal(row({ scope: "nationwide" })).scope, "nationwide");
});

test("blank optional strings become null / empty", () => {
  const deal = mapPublishedDeal(
    row({ redeem_url: "   ", source: "", website: "  ", known_for: "  " })
  );
  assert.equal(deal.redeemUrl, null);
  assert.equal(deal.source, null);
  assert.equal(deal.website, null);
  assert.equal(deal.knownFor, "");
});

test("falls back to region_key for city when city is absent", () => {
  const deal = mapPublishedDeal(row({ city: null, region_key: "mesa-az" }));
  assert.equal(deal.city, "mesa-az");
});
