import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dealsSeeAllLabel,
  formatDealCount,
  shouldShowDeals,
} from "./dealCounts.ts";

test("shouldShowDeals hides only at zero", () => {
  assert.equal(shouldShowDeals(0), false);
  assert.equal(shouldShowDeals(1), true);
  assert.equal(shouldShowDeals(437), true);
  assert.equal(shouldShowDeals(Number.NaN), false);
  assert.equal(shouldShowDeals(-3), false);
});

test("formatDealCount buckets at 100", () => {
  assert.equal(formatDealCount(0), "0");
  assert.equal(formatDealCount(1), "1");
  assert.equal(formatDealCount(99), "99");
  assert.equal(formatDealCount(100), "100+");
  assert.equal(formatDealCount(437), "100+");
  assert.equal(formatDealCount(2184), "100+");
});

test("dealsSeeAllLabel pluralizes and buckets", () => {
  assert.equal(dealsSeeAllLabel(1), "See all 1 offer");
  assert.equal(dealsSeeAllLabel(2), "See all 2 offers");
  assert.equal(dealsSeeAllLabel(99), "See all 99 offers");
  assert.equal(dealsSeeAllLabel(100), "See all 100+ offers");
  assert.equal(dealsSeeAllLabel(2184), "See all 100+ offers");
});
