import { describe, expect, it } from "vitest";
import {
  CATEGORY_ICON_DICTIONARY,
  editorialTitleWithIcon,
  resolveEventCategoryIcon,
} from "./categoryIcon";

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
});
