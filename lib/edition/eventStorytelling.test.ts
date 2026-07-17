import { describe, expect, it } from "vitest";
import {
  classifyEventStoryType,
  passesEventGoldenTest,
} from "./eventStorytelling";

describe("eventStorytelling", () => {
  it("classifies farmers markets and concerts differently", () => {
    expect(
      classifyEventStoryType({
        name: "Queen Creek Farmers Market",
        venue: "Queen Creek",
      })
    ).toBe("farmers_market");
    expect(
      classifyEventStoryType({
        name: "Live Jazz at The Nash",
        venue: "The Nash",
        category: "music",
      })
    ).toBe("concert");
  });

  it("golden test rejects copy that could describe any event", () => {
    expect(
      passesEventGoldenTest({
        name: "Watercolor Workshop at Queen Creek Olive Mill",
        venue: "Queen Creek Olive Mill",
        editorialBody: ["An event is happening Friday night."],
      })
    ).toBe(false);
    expect(
      passesEventGoldenTest({
        name: "Watercolor Workshop at Queen Creek Olive Mill",
        venue: "Queen Creek Olive Mill",
        banditNote:
          "Queen Creek Olive Mill hosts a watercolor workshop with a seasonal spritz.",
        editorialBody: [
          "Guests paint a desert-inspired landscape during the evening session at the mill.",
        ],
      })
    ).toBe(true);
  });
});
