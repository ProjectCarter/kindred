import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildMasterpieceCreditLine, inferMediumLabel } from "./attribution.ts";

Deno.test("painting with named artist and museum", () => {
  const line = buildMasterpieceCreditLine({
    artist: "Claude Monet",
    license: "public_domain",
    sourceInstitution: "Musée d'Orsay",
    collections: ["impressionism"],
  });
  assertEquals(line, "Painting by Claude Monet • Public Domain via Musée d'Orsay");
});

Deno.test("courtesy line for institution-led open access", () => {
  const line = buildMasterpieceCreditLine({
    artist: "Unknown artist",
    license: "museum_open_access",
    sourceInstitution: "National Gallery of Art",
  });
  assertEquals(
    line,
    "Artwork courtesy of the National Gallery of Art • Public Domain"
  );
});

Deno.test("woodblock print attribution", () => {
  const line = buildMasterpieceCreditLine({
    artist: "Katsushika Hokusai",
    license: "public_domain",
    sourceInstitution: "The Metropolitan Museum of Art",
    collections: ["ukiyo_e"],
  });
  assertEquals(
    line,
    "Woodblock print by Katsushika Hokusai • Public Domain via The Metropolitan Museum of Art"
  );
});

Deno.test("botanical illustration", () => {
  const line = buildMasterpieceCreditLine({
    artist: "Maria Sibylla Merian",
    license: "public_domain",
    sourceInstitution: "Wikimedia Commons",
    collections: ["botanical_illustration"],
  });
  assertEquals(line, "Illustration by Maria Sibylla Merian • Public Domain");
});

Deno.test("unsplash photography", () => {
  const line = buildMasterpieceCreditLine({
    artist: "Jane Smith",
    license: "cc0",
    sourceInstitution: "Unsplash",
  });
  assertEquals(line, "Photography by Jane Smith • Courtesy of Unsplash");
});

Deno.test("pexels photo", () => {
  const line = buildMasterpieceCreditLine({
    artist: "John Doe",
    license: "cc0",
    sourceInstitution: "Pexels",
  });
  assertEquals(line, "Photo by John Doe • Licensed via Pexels");
});

Deno.test("inferMediumLabel detects woodblock from collection", () => {
  assertEquals(
    inferMediumLabel({
      artist: "Hokusai",
      license: "public_domain",
      sourceInstitution: "Met",
      collections: ["ukiyo_e"],
    }),
    "Woodblock print"
  );
});
