import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { classifyImageSubject } from "./taxonomy.ts";

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

Deno.test("low confidence for vague title", () => {
  const result = classifyImageSubject({
    title: "Great Sunset Photography Spot",
    discoveryCategory: "scenic_drives",
  });
  assertEquals(result.confidence === "low" || result.primary === "scenic_drive", true);
});
