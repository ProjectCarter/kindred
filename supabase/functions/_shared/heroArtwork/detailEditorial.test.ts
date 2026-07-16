import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  validateLongStoryBody,
  validateLookCloserItems,
  isMasterpieceDetailComplete,
} from "./detailEditorial.ts";

const SAMPLE_STORY =
  "First paragraph with enough words to satisfy the editorial minimum for a substantial opening that orients the reader to the artwork and its historical moment without rushing the eye.\n\n" +
  "Second paragraph explaining the artist's working context and what was changing in the period when the work took shape, giving the reader a sense of why the subject mattered then.\n\n" +
  "Third paragraph describing what the viewer is actually seeing in the composition, including light, structure, and the relationship between foreground and background elements.\n\n" +
  "Fourth paragraph on why the work became significant and how later audiences came to value its particular contribution to art and culture over time.";

Deno.test("long story requires four or more substantial paragraphs", () => {
  const valid = validateLongStoryBody(SAMPLE_STORY);
  assertEquals(valid.valid, true);
  assertEquals(valid.paragraphCount >= 4, true);
});

Deno.test("look closer requires at least two observations", () => {
  const valid = validateLookCloserItems([
    "Notice how the light gathers along the upper edge of the canvas.",
    "Look at the brushwork in the sky — short strokes suggest movement rather than still air.",
  ]);
  assertEquals(valid.valid, true);
});

Deno.test("detail completeness rejects pending editorial status", () => {
  assertEquals(
    isMasterpieceDetailComplete({
      longStoryBody: SAMPLE_STORY,
      artistBiography: "A concise biography with enough words to pass validation for the artist section in the masterpiece reader experience.",
      lookCloserItems: [
        "Notice the direction of the light across the central passage of the painting.",
        "Compare the warm foreground tones with the cooler distance.",
      ],
      didYouKnow: "The work is preserved in an open museum collection available for public study.",
      museumName: "Metropolitan Museum of Art",
      museumLocation: "New York, United States",
      officialMuseumUrl: "https://www.metmuseum.org/",
      officialArtworkUrl: "https://www.metmuseum.org/art/collection/search/1",
      sourceReferences: ["https://www.metmuseum.org/"],
      detailEditorialStatus: "pending",
    }),
    false
  );
});
