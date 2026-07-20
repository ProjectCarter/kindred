import { assertEquals, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  containsWikidataSyntax,
  parseArtworkYearFromText,
  sanitizeArtworkTitle,
  sanitizeArtistName,
  sanitizeEditorialText,
  stripWikidataMarkup,
} from "./sanitizeMetadata.ts";

const DAHL_RAW =
  'Stream in the Liebethaler Grund title QS:P1476,en:"Stream in the Liebethaler Grund " label QS:Len,"Stream in the Liebethaler Grund " labe…';

const DAHL_FILE =
  "File:Johan Christian Dahl - Stream in the Liebethaler Grund - NG.M.01949 - National Museum of Art, Architecture and Design.jpg";

Deno.test("containsWikidataSyntax detects QS and label metadata", () => {
  assertEquals(containsWikidataSyntax(DAHL_RAW), true);
  assertEquals(containsWikidataSyntax("Stream in the Liebethaler Grund"), false);
  assertEquals(containsWikidataSyntax("Water Lilies"), false);
});

Deno.test("sanitizeArtworkTitle returns human-readable title from Wikidata block", () => {
  const title = sanitizeArtworkTitle(DAHL_RAW, { filePageTitle: DAHL_FILE });
  assertEquals(title, "Stream in the Liebethaler Grund");
  assertFalse(containsWikidataSyntax(title));
  assertFalse(title.includes("QS:"));
  assertFalse(title.includes("label"));
  assertFalse(title.includes("labe"));
});

Deno.test("sanitizeArtworkTitle prefers clean ObjectName", () => {
  const title = sanitizeArtworkTitle(DAHL_RAW, {
    objectName: "Stream in the Liebethaler Grund",
    filePageTitle: DAHL_FILE,
  });
  assertEquals(title, "Stream in the Liebethaler Grund");
});

Deno.test("sanitizeArtworkTitle falls back to File page title", () => {
  const title = sanitizeArtworkTitle("", { filePageTitle: DAHL_FILE });
  assertEquals(title, "Stream in the Liebethaler Grund");
});

Deno.test("sanitizeArtistName returns human-readable artist", () => {
  const artist = sanitizeArtistName(
    '<a href="/wiki/Johan_Christian_Dahl">Johan Christian Dahl</a>',
    DAHL_FILE
  );
  assertEquals(artist, "Johan Christian Dahl");
  assertFalse(containsWikidataSyntax(artist));
});

Deno.test("parseArtworkYearFromText ignores Wikidata property numbers", () => {
  assertEquals(parseArtworkYearFromText(DAHL_RAW), null);
  assertEquals(parseArtworkYearFromText("Painted circa 1818"), "1818");
  assertEquals(parseArtworkYearFromText("NG.M.01949 (1820)"), "1820");
});

Deno.test("stripWikidataMarkup removes property IDs and label blocks", () => {
  const cleaned = stripWikidataMarkup(DAHL_RAW);
  assertEquals(cleaned, "Stream in the Liebethaler Grund");
  assertFalse(/\bP\d{3,}\b/.test(cleaned));
  assertFalse(/QS:/i.test(cleaned));
});

Deno.test("sanitizeEditorialText never leaves QS syntax", () => {
  const body =
    `${DAHL_RAW} is a celebrated work by Johan Christian Dahl. ` +
    "It reflects the visual language of romanticism.";
  const cleaned = sanitizeEditorialText(body);
  assertFalse(/QS:/i.test(cleaned));
  assertFalse(/\blabel\b/i.test(cleaned));
  assertFalse(/labe…/.test(cleaned));
  assertEquals(cleaned.startsWith("Stream in the Liebethaler Grund is"), true);
});

Deno.test("sanitizeEditorialText preserves paragraph breaks", () => {
  const body = [
    "First paragraph with enough words to survive editorial validation gates cleanly.",
    "Second paragraph with enough words to survive editorial validation gates cleanly.",
    "Third paragraph with enough words to survive editorial validation gates cleanly.",
    "Fourth paragraph with enough words to survive editorial validation gates cleanly.",
    "Fifth paragraph with enough words to survive editorial validation gates cleanly.",
    "Sixth paragraph with enough words to survive editorial validation gates cleanly.",
  ].join("\n\n");
  const cleaned = sanitizeEditorialText(body);
  assertEquals(cleaned.split(/\n{2,}/).length, 6);
});
