import { describe, expect, it } from "vitest";
import {
  CATEGORY_ICON_DICTIONARY,
  editorialTitleWithIcon,
  resolveEventCategoryIcon,
} from "./categoryIcon";
import {
  EDITORIAL_EMOJI,
  resolveEditorialEmojiFromHay,
} from "./editorialEmojiCatalog";

describe("editorialEmojiCatalog", () => {
  it("uses 🌮 for taco festival, not 🎉", () => {
    expect(resolveEditorialEmojiFromHay("gilbert taco festival")).toBe(EDITORIAL_EMOJI.tacos);
    expect(
      resolveEventCategoryIcon({
        name: "Gilbert Taco Festival",
        venue: "Downtown",
        category: "food",
      })
    ).toBe(EDITORIAL_EMOJI.tacos);
  });

  it("uses 🍷 for wine tasting, not 🍽️", () => {
    expect(
      resolveEventCategoryIcon({
        name: "Sunset Wine Tasting",
        venue: "Desert Ridge",
        category: "food",
      })
    ).toBe(EDITORIAL_EMOJI.winery);
  });

  it("uses 🎸 for rock tribute, not 🎵", () => {
    expect(
      resolveEventCategoryIcon({
        name: "Pearl Jam Tribute Night",
        venue: "The Van Buren",
        category: "music",
      })
    ).toBe(EDITORIAL_EMOJI.rock_concert);
  });

  it("uses 💼 for networking breakfast", () => {
    expect(
      resolveEventCategoryIcon({
        name: "Chamber Business Breakfast",
        venue: "Convention Center",
        category: "community",
      })
    ).toBe(EDITORIAL_EMOJI.business);
  });

  it("uses 🌱 for gardening workshop", () => {
    expect(
      resolveEventCategoryIcon({
        name: "Community Gardening Workshop",
        venue: "Riparian Preserve",
        category: "community",
      })
    ).toBe(EDITORIAL_EMOJI.gardening);
  });

  it("uses 🏃 for marathon", () => {
    expect(
      resolveEventCategoryIcon({
        name: "Phoenix Marathon",
        venue: "Downtown",
        category: "sports",
      })
    ).toBe(EDITORIAL_EMOJI.running);
  });

  it("reserves 🤝 for explicit networking only", () => {
    expect(
      resolveEventCategoryIcon({
        name: "Young Professionals Networking Mixer",
        venue: "Hotel Valley Ho",
        category: "community",
      })
    ).toBe(EDITORIAL_EMOJI.community_networking);

    expect(
      resolveEventCategoryIcon({
        name: "Neighborhood Block Party",
        venue: "Oak Street",
        category: "community",
      })
    ).toBe(EDITORIAL_EMOJI.celebration);
    expect(
      resolveEventCategoryIcon({
        name: "Neighborhood Block Party",
        venue: "Oak Street",
        category: "community",
      })
    ).not.toBe(EDITORIAL_EMOJI.community_networking);
  });
});

describe("categoryIcon — Visual Language v1", () => {
  it("maps farmers market to 🥕", () => {
    expect(
      resolveEventCategoryIcon({
        name: "Queen Creek Farmers Market",
        venue: "Queen Creek",
        category: "market",
      })
    ).toBe(CATEGORY_ICON_DICTIONARY.farmers_market);
  });

  it("prioritizes brewery over live music", () => {
    expect(
      resolveEventCategoryIcon({
        name: "Jazz Night",
        venue: "Desert Eagle Brewing",
        category: "music",
      })
    ).toBe(CATEGORY_ICON_DICTIONARY.brewery);
  });

  it("strips stacked emoji from titles", () => {
    expect(editorialTitleWithIcon("☕", "☕ Joe's Coffee")).toBe("☕ Joe's Coffee");
  });

  it("never uses 🤝 as the generic community section fallback", () => {
    expect(
      resolveEventCategoryIcon({
        name: "Community Day at the Park",
        venue: "Freestone Park",
        category: "community",
      })
    ).not.toBe(EDITORIAL_EMOJI.community_networking);
  });
});
