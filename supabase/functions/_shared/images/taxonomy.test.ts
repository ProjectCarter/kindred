import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { classifyImageSubject } from "./taxonomy.ts";
import { resolveVenueClassification } from "../venueClassification.ts";

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
