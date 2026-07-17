import { describe, expect, it } from "vitest";
import {
  passesLastingThoughtTest,
  validateLastingThought,
} from "./memorableWriting";

describe("memorableWriting", () => {
  it("rejects generic takeaways", () => {
    expect(
      passesLastingThoughtTest(
        "This city has a rich history. This remains important today."
      )
    ).toBe(false);
    expect(
      validateLastingThought("The artwork continues to inspire visitors.")
        .reason
    ).toBe("generic_takeaway");
  });

  it("accepts articles with a specific memorable idea", () => {
    expect(
      passesLastingThoughtTest(
        [
          "Gilbert incorporated in 1912, the year Arizona became a state.",
          "The water tower held 20,000 gallons when built in 1927.",
          "When the water tower lights switch on at dusk, they illuminate both a farm town and a suburb still arguing about density.",
        ].join("\n\n"),
        { subjectTokens: ["Gilbert", "water tower"] }
      )
    ).toBe(true);
  });

  it("rejects copy with no memorable anchor", () => {
    expect(
      passesLastingThoughtTest(
        "The venue hosts events throughout the year. Arrive early for parking."
      )
    ).toBe(false);
  });
});
