import { describe, expect, it } from "vitest";
import {
  extractLastParagraph,
  passesUniqueConclusionTest,
} from "./uniqueConclusions";

describe("uniqueConclusions", () => {
  it("rejects reusable Kindred wrap-ups", () => {
    expect(
      passesUniqueConclusionTest(
        "Kindred keeps these anniversaries on the front page because they explain how we got here."
      )
    ).toBe(false);
    expect(
      passesUniqueConclusionTest(
        "Return to it when you can — and until then, let today's masterpiece slow the morning by a minute or two."
      )
    ).toBe(false);
    expect(
      passesUniqueConclusionTest("I'll keep looking. See you tomorrow.")
    ).toBe(false);
  });

  it("accepts subject-specific conclusions", () => {
    expect(
      passesUniqueConclusionTest(
        "When fog lifts over Elliott Bay and a ferry horn carries across the water, the same harbor that stopped settlers in 1851 still asks what kind of city you build.",
        { subjectTokens: ["Seattle", "Elliott", "ferry"] }
      )
    ).toBe(true);
  });

  it("extracts the last paragraph from body text", () => {
    const body = "First paragraph.\n\nMiddle paragraph.\n\nFinal legacy paragraph.";
    expect(extractLastParagraph(body)).toBe("Final legacy paragraph.");
  });
});
