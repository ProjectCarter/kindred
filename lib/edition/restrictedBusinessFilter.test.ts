import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assessRestrictedBusinessListing,
  isRestrictedBusinessListing,
} from "./restrictedBusinessFilter.ts";

const EXCLUDE = [
  // Weapons / firearms / tactical / knife / survival
  { name: "Desert Eagle Gun Shop", venueCategories: ["Gun Store"] },
  { name: "Cave Creek Shooting Range" },
  { name: "Patriot Firearms & Ammo" },
  { name: "Tactical Gear Supply Co." },
  { name: "Blade & Bone Knife Store" },
  { name: "Off-Grid Survivalist Outfitters" },
  { name: "Superstition Armory" },
  { name: "Frontline Army Surplus" },
  // Cannabis
  { name: "Green Leaf Dispensary", venueCategories: ["Cannabis Dispensary"] },
  { name: "Sonoran Roots Cannabis Co." },
  { name: "Nature's Wellness CBD Store" },
  // Vape / smoke / tobacco / hookah
  { name: "Cloud 9 Vape Shop" },
  { name: "Downtown Smoke Shop" },
  { name: "Oasis Hookah Lounge" },
  { name: "Old Town Tobacco Store" },
  // Gambling
  { name: "Talking Stick Casino", venueCategories: ["Casino"] },
  { name: "Lucky Ace Poker Room" },
  { name: "Downtown Sports Betting Lounge" },
  { name: "Ladbrokes Bookmaker" },
  // Adult-oriented
  { name: "Diamond Club Gentlemen's Club", venueCategories: ["Strip Club"] },
  { name: "Romantix Adult Superstore" },
  { name: "Paradise Sex Shop" },
  // Not operating (V4)
  { name: "Old Mill Grill (Permanently Closed)" },
  { name: "Corner Diner", dek: "This location is out of business." },
  { name: "The Defunct Theater Co." },
  { name: "Riverside Bowl", dek: "The building was demolished in 2019." },
  { name: "Java Stop", dek: "No longer operating at this address." },
];

const KEEP = [
  // Real experiences / venues with no trigger word
  { name: "Escapology Escape Rooms", venueCategories: ["Escape Room"] },
  { name: "Desert Botanical Garden", venueCategories: ["Botanical Garden"] },
  { name: "Gilbert Historical Museum", venueCategories: ["History Museum"] },
  // Trigger word inside a genuine restaurant/experience — safe harbor keeps them
  { name: "The Smoke Shop BBQ", venueCategories: ["Barbecue Restaurant"] },
  { name: "Gun Barrel Steakhouse", venueCategories: ["Steakhouse"] },
  { name: "Topgolf", venueCategories: ["Golf", "Driving Range"] },
  { name: "Riverview Golf Course Driving Range", venueCategories: ["Golf Course"] },
  { name: "Bad Axe Throwing", venueCategories: ["Axe Throwing"] },
  { name: "Smokehouse 66", venueCategories: ["Barbecue"] },
  { name: "Smoky Mountain Coffee Roasters", venueCategories: ["Coffee Shop"] },
  { name: "Pistol Pete's Pizzeria", venueCategories: ["Pizzeria"] },
];

test("restricted-business filter excludes constitutionally restricted categories", () => {
  for (const listing of EXCLUDE) {
    const a = assessRestrictedBusinessListing(listing);
    assert.equal(
      a.excluded,
      true,
      `expected EXCLUDE: ${listing.name} (${a.signal ?? "no signal"})`
    );
    assert.ok(a.signal, `expected a diagnostic signal for ${listing.name}`);
    assert.ok(a.category, `expected a category for ${listing.name}`);
  }
});

test("restricted-business filter keeps real food/experiences (trigger-word safe harbor)", () => {
  for (const listing of KEEP) {
    assert.equal(
      isRestrictedBusinessListing(listing),
      false,
      `expected KEEP: ${listing.name}`
    );
  }
});

test("empty input is never excluded", () => {
  assert.equal(assessRestrictedBusinessListing({ name: "" }).excluded, false);
});
