import { test } from "node:test";
import assert from "node:assert/strict";
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
  { name: "Desert Schools Credit Union" },
  { name: "First National Bank" },
  { name: "Grace Community Church" },
  { name: "Valley Realty", venueCategories: ["Real Estate"] },
  { name: "Joe's Auto Repair & Body Shop" },
  { name: "SecureSpace Self Storage" },
  { name: "Gilbert Distribution Center", venueCategories: ["Warehouse"] },
  { name: "Riverside Executive Suites", venueCategories: ["Office Park"] },
  { name: "Precision Manufacturing", venueCategories: ["Machine Shop"] },
  { name: "Maricopa County Courthouse" },
  { name: "Gilbert City Hall" },
  { name: "Apex Business Solutions", venueCategories: ["Consulting Firm"] },
];

const KEEP = [
  { name: "Escapology Escape Rooms", venueCategories: ["Escape Room"] },
  { name: "Bowlero", venueCategories: ["Bowling Alley"] },
  { name: "Desert Botanical Garden", venueCategories: ["Botanical Garden"] },
  { name: "Gilbert Historical Museum", venueCategories: ["History Museum"] },
  { name: "Riparian Preserve", venueCategories: ["Park", "Nature Preserve"] },
  { name: "Main Event Mini Golf", venueCategories: ["Mini Golf"] },
  { name: "AZ On The Rocks Climbing Gym", venueCategories: ["Rock Climbing"] },
  { name: "Saguaro Lake Kayak Tours", venueCategories: ["Boat Rental"] },
  // Genuine experiences that contain a trigger word — safe harbor keeps them:
  { name: "Corner Pocket Pool Hall & Billiards", venueCategories: ["Pool Hall"] },
  { name: "The Warehouse Music Venue", venueCategories: ["Music Venue"] },
  { name: "Historic Mission Church Guided Tour", venueCategories: ["Historic Site"] },
];

test("service-business filter excludes everyday service/professional businesses", () => {
  for (const listing of EXCLUDE) {
    const a = assessServiceBusinessListing(listing);
    assert.equal(a.excluded, true, `expected EXCLUDE: ${listing.name} (${a.signal ?? "no signal"})`);
    assert.ok(a.signal, `expected a diagnostic signal for ${listing.name}`);
  }
});

test("service-business filter keeps real experiences (incl. trigger-word safe harbor)", () => {
  for (const listing of KEEP) {
    assert.equal(
      isServiceBusinessListing(listing),
      false,
      `expected KEEP: ${listing.name}`
    );
  }
});

test("empty input is never excluded", () => {
  assert.equal(assessServiceBusinessListing({ name: "" }).excluded, false);
});
