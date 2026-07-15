import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { applyEventCategoryVariety } from "./variety.ts";
import type { LocalEvent } from "./provider.ts";

function event(name: string, category: LocalEvent["category"]): LocalEvent {
  return {
    name,
    startDateTime: "Sat · 7 PM",
    venue: "Main Hall",
    city: "Gilbert",
    sourceUrl: "https://example.com",
    sourceName: "Listing",
    category,
  };
}

Deno.test("applyEventCategoryVariety caps at two per category", () => {
  const events = [
    event("Jazz Night 1", "music"),
    event("Jazz Night 2", "music"),
    event("Jazz Night 3", "music"),
    event("Farmers Market", "market"),
    event("Comedy Hour", "comedy"),
  ];

  const varied = applyEventCategoryVariety(events);
  const musicCount = varied.filter((e) => e.category === "music").length;
  assertEquals(musicCount, 2);
  assertEquals(varied.length, 4);
});
