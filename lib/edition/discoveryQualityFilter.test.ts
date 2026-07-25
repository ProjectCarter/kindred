import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assessDiscoveryQuality,
  isDiscoveryQualityExcluded,
} from "./discoveryQualityFilter.ts";

test("quality filter excludes restricted businesses (V3 categories)", () => {
  for (const listing of [
    { name: "Desert Eagle Gun Shop" },
    { name: "Green Leaf Dispensary" },
    { name: "Cloud 9 Vape Shop" },
    { name: "Talking Stick Casino" },
    { name: "Diamond Club Gentlemen's Club" },
  ]) {
    assert.equal(
      isDiscoveryQualityExcluded(listing),
      true,
      `expected excluded: ${listing.name}`
    );
  }
});

test("quality filter excludes everyday service/office businesses", () => {
  for (const listing of [
    { name: "Blue Wave Pool Service" },
    { name: "Summit Roofing Co." },
    { name: "Miller & Associates Law Firm" },
    { name: "Riverside Executive Suites", venueCategories: ["Office Park"] },
  ]) {
    assert.equal(
      isDiscoveryQualityExcluded(listing),
      true,
      `expected excluded: ${listing.name}`
    );
  }
});

test("quality filter keeps genuine destinations", () => {
  for (const listing of [
    { name: "Desert Botanical Garden", venueCategories: ["Botanical Garden"] },
    { name: "Grimaldi's Pizzeria", venueCategories: ["Pizzeria"] },
    { name: "The Bank Cafe", venueCategories: ["Coffee Shop"] },
    { name: "The Smoke Shop BBQ", venueCategories: ["Barbecue Restaurant"] },
    { name: "Escapology Escape Rooms", venueCategories: ["Escape Room"] },
  ]) {
    const a = assessDiscoveryQuality(listing);
    assert.equal(a.eligible, true, `expected eligible: ${listing.name} (${a.reason ?? ""})`);
  }
});
