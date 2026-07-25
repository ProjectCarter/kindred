import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assessDiscoveryQuality,
  isDiscoveryQualityExcluded,
} from "./discoveryQualityFilter.ts";

Deno.test("quality filter excludes restricted businesses (V3 categories)", () => {
  for (const listing of [
    { name: "Desert Eagle Gun Shop" },
    { name: "Green Leaf Dispensary" },
    { name: "Cloud 9 Vape Shop" },
    { name: "Talking Stick Casino" },
    { name: "Diamond Club Gentlemen's Club" },
  ]) {
    assertEquals(isDiscoveryQualityExcluded(listing), true, `excluded: ${listing.name}`);
  }
});

Deno.test("quality filter excludes service + family-friendly editorial exclusions", () => {
  for (const listing of [
    { name: "Blue Wave Pool Service" },
    { name: "Miller & Associates Law Firm" },
    { name: "XXX Adult Superstore" },
  ]) {
    assertEquals(isDiscoveryQualityExcluded(listing), true, `excluded: ${listing.name}`);
  }
});

Deno.test("quality filter keeps genuine destinations", () => {
  for (const listing of [
    { name: "Desert Botanical Garden", venueCategories: ["Botanical Garden"] },
    { name: "Grimaldi's Pizzeria", venueCategories: ["Pizzeria"] },
    { name: "The Bank Cafe", venueCategories: ["Coffee Shop"] },
    { name: "The Smoke Shop BBQ", venueCategories: ["Barbecue Restaurant"] },
  ]) {
    assertEquals(assessDiscoveryQuality(listing).eligible, true, `eligible: ${listing.name}`);
  }
});
