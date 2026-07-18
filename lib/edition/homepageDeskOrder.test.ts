import test from "node:test";
import assert from "node:assert/strict";
import {
  HOMEPAGE_DESK_ORDER,
  isHomepageDeskBefore,
} from "./homepageDeskOrder.ts";

test("homepage desk order places Food & Drinks after Activities and before Story of", () => {
  assert.ok(isHomepageDeskBefore("activities", "food_drinks"));
  assert.ok(isHomepageDeskBefore("food_drinks", "story_of"));
  assert.ok(isHomepageDeskBefore("local_events", "food_drinks"));

  const activitiesIdx = HOMEPAGE_DESK_ORDER.indexOf("activities");
  const foodIdx = HOMEPAGE_DESK_ORDER.indexOf("food_drinks");
  const storyIdx = HOMEPAGE_DESK_ORDER.indexOf("story_of");
  assert.ok(activitiesIdx >= 0 && foodIdx === activitiesIdx + 1);
  assert.ok(storyIdx === foodIdx + 1);
});
