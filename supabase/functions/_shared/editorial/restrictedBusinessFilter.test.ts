import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assessRestrictedBusinessListing,
  isRestrictedBusinessListing,
} from "./restrictedBusinessFilter.ts";

const EXCLUDE = [
  { name: "Desert Eagle Gun Shop", venueCategories: ["Gun Store"] },
  { name: "Cave Creek Shooting Range" },
  { name: "Patriot Firearms & Ammo" },
  { name: "Tactical Gear Supply Co." },
  { name: "Blade & Bone Knife Store" },
  { name: "Off-Grid Survivalist Outfitters" },
  { name: "Superstition Armory" },
  { name: "Frontline Army Surplus" },
  { name: "Green Leaf Dispensary", venueCategories: ["Cannabis Dispensary"] },
  { name: "Sonoran Roots Cannabis Co." },
  { name: "Nature's Wellness CBD Store" },
  { name: "Cloud 9 Vape Shop" },
  { name: "Downtown Smoke Shop" },
  { name: "Oasis Hookah Lounge" },
  { name: "Old Town Tobacco Store" },
  { name: "Talking Stick Casino", venueCategories: ["Casino"] },
  { name: "Lucky Ace Poker Room" },
  { name: "Downtown Sports Betting Lounge" },
  { name: "Ladbrokes Bookmaker" },
  { name: "Diamond Club Gentlemen's Club", venueCategories: ["Strip Club"] },
  { name: "Romantix Adult Superstore" },
  { name: "Paradise Sex Shop" },
  { name: "Old Mill Grill (Permanently Closed)" },
  { name: "Corner Diner", dek: "This location is out of business." },
  { name: "The Defunct Theater Co." },
  { name: "Riverside Bowl", dek: "The building was demolished in 2019." },
  { name: "Java Stop", dek: "No longer operating at this address." },
];

const KEEP = [
  { name: "Escapology Escape Rooms", venueCategories: ["Escape Room"] },
  { name: "Desert Botanical Garden", venueCategories: ["Botanical Garden"] },
  { name: "Gilbert Historical Museum", venueCategories: ["History Museum"] },
  { name: "The Smoke Shop BBQ", venueCategories: ["Barbecue Restaurant"] },
  { name: "Gun Barrel Steakhouse", venueCategories: ["Steakhouse"] },
  { name: "Topgolf", venueCategories: ["Golf", "Driving Range"] },
  { name: "Riverview Golf Course Driving Range", venueCategories: ["Golf Course"] },
  { name: "Bad Axe Throwing", venueCategories: ["Axe Throwing"] },
  { name: "Smokehouse 66", venueCategories: ["Barbecue"] },
  { name: "Smoky Mountain Coffee Roasters", venueCategories: ["Coffee Shop"] },
  { name: "Pistol Pete's Pizzeria", venueCategories: ["Pizzeria"] },
];

Deno.test("restricted-business filter excludes constitutionally restricted categories", () => {
  for (const listing of EXCLUDE) {
    const a = assessRestrictedBusinessListing(listing);
    assertEquals(a.excluded, true, `expected EXCLUDE: ${listing.name}`);
  }
});

Deno.test("restricted-business filter keeps real food/experiences (safe harbor)", () => {
  for (const listing of KEEP) {
    assertEquals(
      isRestrictedBusinessListing(listing),
      false,
      `expected KEEP: ${listing.name}`
    );
  }
});

Deno.test("empty input is never excluded", () => {
  assertEquals(assessRestrictedBusinessListing({ name: "" }).excluded, false);
});
