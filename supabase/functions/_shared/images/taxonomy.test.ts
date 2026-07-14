import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { classifyImageSubject } from "./taxonomy.ts";
import { resolveVenueClassification } from "../venueClassification.ts";
import {
  buildCategoryImageSearchQueries,
  editorialCopyConflicts,
  resolveVerifiedEditorialCategory,
} from "../editorialCategory.ts";

Deno.test("classify country club not as beach", () => {
  const result = classifyImageSubject({
    title: "Val Vista Lakes Country Club",
    venueCategories: ["Event Space", "Beach"],
    discoveryCategory: "beaches",
  });
  assertEquals(result.primary, "country_club");
  assertEquals(result.confidence, "high");
});

Deno.test("classify rock shop not as museum flower", () => {
  const result = classifyImageSubject({
    title: "Rock Shop (Natural Expressions, INC.)",
    venueCategories: ["Art Museum", "Health and Beauty Service"],
    discoveryCategory: "museums",
  });
  assertEquals(result.primary, "rock_shop");
  assertEquals(result.confidence, "high");
});

Deno.test("classify coffee shop", () => {
  const result = classifyImageSubject({
    title: "Coffee Rush",
    discoveryCategory: "coffee",
  });
  assertEquals(result.primary, "coffee_shop");
});

Deno.test("classify escape room", () => {
  const result = classifyImageSubject({
    title: "Escapology Gilbert",
    venueCategories: ["Escape Room"],
    discoveryCategory: "activities",
  });
  assertEquals(result.primary, "escape_room");
});

Deno.test("classify dog park not playground", () => {
  const result = classifyImageSubject({
    title: "Cosmo Dog Park",
    venueCategories: ["Dog Park"],
    discoveryCategory: "parks",
    city: "Gilbert",
  });
  assertEquals(result.primary, "dog_park");
  assertEquals(result.searchQueries[0]?.includes("Cosmo Dog Park"), true);
});

Deno.test("classify history museum", () => {
  const venue = resolveVenueClassification({
    title: "Gilbert Historical Museum",
    venueCategories: ["History Museum"],
    discoveryCategory: "museums",
  });
  assertEquals(venue.displayLabel, "history museum");
  assertEquals(venue.editorialType, "history_museum");
});

Deno.test("classify observatory not scenic drive", () => {
  const result = classifyImageSubject({
    title: "Lowell Observatory",
    venueCategories: ["Observatory"],
    discoveryCategory: "scenic_drives",
  });
  assertEquals(result.primary, "specialty_museum");
});

Deno.test("venue search queries prioritize exact place", () => {
  const result = classifyImageSubject({
    title: "Escapology Gilbert",
    venueCategories: ["Escape Room"],
    discoveryCategory: "activities",
    city: "Gilbert",
    address: "123 Main St, Gilbert, Arizona",
  });
  assertEquals(result.searchQueries.length >= 2, true);
  assertEquals(result.searchQueries[0]?.includes("Escapology"), true);
  assertEquals(result.searchQueries[0]?.includes("Gilbert"), true);
});

Deno.test("low confidence for vague title", () => {
  const result = classifyImageSubject({
    title: "Great Sunset Photography Spot",
    discoveryCategory: "scenic_drives",
  });
  assertEquals(result.confidence === "low" || result.primary === "scenic_drive", true);
});

Deno.test("classify winery not beach from misleading category", () => {
  const verified = resolveVerifiedEditorialCategory({
    title: "The Wine Box",
    venueCategories: ["Winery", "Wine Bar"],
    discoveryCategory: "beaches",
    dek: "Wine tasting and patio seating downtown.",
  });
  assertEquals(verified.categoryId, "winery");
  assertEquals(verified.confidence, "verified");
  const queries = buildCategoryImageSearchQueries({
    title: "The Wine Box",
    city: "Gilbert",
    category: verified,
  });
  assertEquals(queries.some((q) => /winery|wine/i.test(q)), true);
  assertEquals(queries.some((q) => /beach|ocean|sand/i.test(q)), false);
});

Deno.test("verified dog park image queries exclude playground", () => {
  const verified = resolveVerifiedEditorialCategory({
    title: "Cosmo Dog Park",
    venueCategories: ["Dog Park"],
    discoveryCategory: "parks",
  });
  assertEquals(verified.categoryId, "dog_park");
  const queries = buildCategoryImageSearchQueries({
    title: "Cosmo Dog Park",
    city: "Gilbert",
    category: verified,
  });
  assertEquals(queries.some((q) => /dog park|dogs/i.test(q)), true);
  assertEquals(queries.some((q) => /playground|swing|slide/i.test(q)), false);
});

Deno.test("classify observatory not scenic drive", () => {
  const verified = resolveVerifiedEditorialCategory({
    title: "Gilbert Rotary Centennial Observatory",
    venueCategories: ["Observatory"],
    discoveryCategory: "scenic_drives",
    dek: "Public telescope viewing and astronomy programs.",
  });
  assertEquals(verified.categoryId, "observation_deck");
  const queries = buildCategoryImageSearchQueries({
    title: "Gilbert Rotary Centennial Observatory",
    city: "Gilbert",
    category: verified,
  });
  assertEquals(queries.some((q) => /observatory|telescope|astronomy/i.test(q)), true);
  assertEquals(queries.some((q) => /scenic drive|highway|road trip/i.test(q)), false);
});

Deno.test("classify bowling alley not kayaking", () => {
  const verified = resolveVerifiedEditorialCategory({
    title: "Bowlero Gilbert",
    venueCategories: ["Bowling Alley"],
    discoveryCategory: "activities",
  });
  assertEquals(verified.categoryId, "bowling_alley");
  assertEquals(
    editorialCopyConflicts(verified.categoryId, "Bowlero is great for kayaking."),
    true
  );
  assertEquals(
    editorialCopyConflicts(verified.categoryId, "Book a lane for Friday night."),
    false
  );
});

Deno.test("never classify from single weak keyword alone", () => {
  const verified = resolveVerifiedEditorialCategory({
    title: "Sunset Viewpoint",
    discoveryCategory: "scenic_drives",
  });
  assertEquals(verified.confidence, "tentative");
});
