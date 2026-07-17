import { describe, expect, it } from "vitest";
import {
  composeEventArticleFromVerifiedData,
  containsBannedEventCopy,
  validateBanditNote,
} from "./eventEditorial";
import type { LocalEventCard } from "./localEvents";

function sampleEvent(overrides: Partial<LocalEventCard> = {}): LocalEventCard {
  return {
    name: "Live Jazz at The Nash",
    date: "Fri, Jul 17",
    time: "8 PM",
    venue: "The Nash",
    city: "Phoenix",
    sourceUrl: "https://www.eventbrite.com/e/live-jazz-at-the-nash-123",
    sourceName: "Eventbrite",
    ...overrides,
  };
}

describe("eventEditorial", () => {
  it("rejects permanently banned Bandit note phrases", () => {
    expect(containsBannedEventCopy("Worth stepping out for — The Nash has something happening tonight.")).toBe(true);
    expect(validateBanditNote("Worth stepping out for — The Nash has something happening tonight.")).toBeNull();
    expect(
      validateBanditNote("Changing Hands always hosts interesting conversations.")
    ).toBe("Changing Hands always hosts interesting conversations.");
  });

  it("builds factual article copy without generic lifestyle templates", () => {
    const body = composeEventArticleFromVerifiedData(
      sampleEvent({
        banditNote: "Outdoor movies are one of the best parts of summer.",
        badges: ["live_music", "tickets_required"],
      })
    );

    expect(body.some((p) => p.includes("Live Jazz at The Nash"))).toBe(true);
    expect(body.some((p) => p.includes("The Nash"))).toBe(true);
    expect(body.some((p) => p.includes("Outdoor movies"))).toBe(true);
    expect(body.some((p) => p.includes("Live music is listed"))).toBe(true);
    expect(body.join(" ")).not.toMatch(/worth stepping out for/i);
    expect(body.join(" ")).not.toMatch(/this is the kind of plan/i);
    expect(body.join(" ")).not.toMatch(/show up with curiosity/i);
  });

  it("uses frozen editorialBody when edition build stored it", () => {
    const body = composeEventArticleFromVerifiedData(
      sampleEvent({
        editorialBody: [
          "The Nash hosts a Friday jazz set with a small-room listening format.",
          "Tickets are handled through Eventbrite; doors typically open before the posted set time.",
        ],
      })
    );

    expect(body[0]).toContain("small-room listening format");
    expect(body).toHaveLength(2);
  });
});
