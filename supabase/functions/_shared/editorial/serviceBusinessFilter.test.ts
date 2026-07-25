import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assessServiceBusinessListing,
  isServiceBusinessListing,
} from "./serviceBusinessFilter.ts";

const EXCLUDE = [
  { name: "Blue Wave Pool Service & Repair" },
  { name: "Desert Air HVAC", venueCategories: ["Heating & Cooling"] },
  { name: "Summit Roofing Co." },
  { name: "Rapid Response Plumbing" },
  { name: "Bugs Away Pest Control" },
  { name: "Miller & Associates Law Firm" },
  { name: "Bright Smiles Dental Care" },
  { name: "State Farm Insurance Agency" },
  { name: "First National Bank" },
  { name: "Grace Community Church" },
  { name: "Valley Realty", venueCategories: ["Real Estate"] },
  { name: "Joe's Auto Repair & Body Shop" },
  { name: "SecureSpace Self Storage" },
  { name: "Riverside Executive Suites", venueCategories: ["Office Park"] },
  { name: "Maricopa County Courthouse" },
  { name: "Apex Business Solutions", venueCategories: ["Consulting Firm"] },
];

const KEEP = [
  { name: "Escapology Escape Rooms", venueCategories: ["Escape Room"] },
  { name: "Desert Botanical Garden", venueCategories: ["Botanical Garden"] },
  { name: "Gilbert Historical Museum", venueCategories: ["History Museum"] },
  { name: "Corner Pocket Pool Hall & Billiards", venueCategories: ["Pool Hall"] },
  { name: "The Warehouse Music Venue", venueCategories: ["Music Venue"] },
  { name: "Historic Mission Church Guided Tour", venueCategories: ["Historic Site"] },
];

Deno.test("service-business filter excludes service/professional businesses", () => {
  for (const listing of EXCLUDE) {
    assertEquals(
      assessServiceBusinessListing(listing).excluded,
      true,
      `expected EXCLUDE: ${listing.name}`
    );
  }
});

Deno.test("service-business filter keeps real experiences", () => {
  for (const listing of KEEP) {
    assertEquals(
      isServiceBusinessListing(listing),
      false,
      `expected KEEP: ${listing.name}`
    );
  }
});
