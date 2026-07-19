import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { HOMEPAGE_INITIAL_RENDER_COUNT } from "./editorialPublishing.ts";
import {
  foodDrinksSeeAllLabel,
  shouldShowEditorialSeeAllFooter,
  shouldShowFoodDrinksSeeAll,
} from "./foodDrinksHomepage.ts";
import {
  HOMEPAGE_DESK_ORDER,
  isHomepageDeskBefore,
} from "./homepageDeskOrder.ts";
import { LIST_SCROLL_KEYS } from "./listScrollSession.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const recommendationsSectionSource = readFileSync(
  join(__dirname, "../../components/RecommendationsSection.tsx"),
  "utf8"
);
const recommendationsScreenSource = readFileSync(
  join(__dirname, "../../app/recommendations.tsx"),
  "utf8"
);

const FOOD_DRINK_SECTION_KICKER = "🍽️ Food & Drinks";
const FOOD_DRINK_SEE_ALL_LABEL = (count: number) =>
  `See all ${count} Food & Drinks`;

test("debug red banner is absent from RecommendationsSection", () => {
  assert.doesNotMatch(recommendationsSectionSource, /FOOD & DRINKS RENDERED HERE/);
  assert.doesNotMatch(recommendationsSectionSource, /FoodDrinksRenderMarker/);
  assert.doesNotMatch(recommendationsSectionSource, /homepageDeskRenderTrace/);
});

test("section kicker uses Food & Drinks title", () => {
  assert.match(recommendationsSectionSource, /Food & Drinks/);
  assert.equal(FOOD_DRINK_SECTION_KICKER, "🍽️ Food & Drinks");
});

test("homepage renders only the curated subset", () => {
  assert.equal(HOMEPAGE_INITIAL_RENDER_COUNT, 8);
  assert.match(
    recommendationsSectionSource,
    /initialRenderCount=\{renderLimit\}/
  );
});

test("dynamic See all label uses full pool count", () => {
  assert.equal(foodDrinksSeeAllLabel(124), "See all 124 Food & Drinks");
  assert.equal(FOOD_DRINK_SEE_ALL_LABEL(124), "See all 124 Food & Drinks");
});

test("See all footer appears when pool exceeds homepage subset", () => {
  assert.equal(
    shouldShowFoodDrinksSeeAll({
      homepageVisibleCount: 8,
      poolItemCount: 124,
      hasSeeAllHandler: true,
    }),
    true
  );
  assert.equal(
    shouldShowEditorialSeeAllFooter({
      hasHandler: true,
      visibleCount: 8,
      seeAllTotal: 124,
      cardCount: 8,
    }),
    true
  );
});

test("See all footer is omitted when there are no additional items", () => {
  assert.equal(
    shouldShowFoodDrinksSeeAll({
      homepageVisibleCount: 8,
      poolItemCount: 8,
      hasSeeAllHandler: true,
    }),
    false
  );
  assert.equal(
    shouldShowEditorialSeeAllFooter({
      hasHandler: true,
      visibleCount: 5,
      seeAllTotal: 5,
      cardCount: 5,
    }),
    false
  );
});

test("full list screen uses stashed guide pool without extra See All cap", () => {
  assert.doesNotMatch(recommendationsScreenSource, /sliceForSeeAll/);
  assert.match(recommendationsScreenSource, /getTodaysRecommendations/);
  assert.match(recommendationsScreenSource, /foodDrinkGuidePlaceCount/);
});

test("See all handoff passes filtered pool not raw items length", () => {
  assert.match(recommendationsSectionSource, /resolveFoodDrinkSeeAllPool/);
  assert.match(recommendationsSectionSource, /seeAllTotal=\{seeAllPool\.length\}/);
  assert.match(recommendationsSectionSource, /onSeeAll\?\.\(seeAllPool\)/);
});

test("homepage desk order keeps Food & Drinks between Activities and Story of", () => {
  assert.ok(isHomepageDeskBefore("activities", "food_drinks"));
  assert.ok(isHomepageDeskBefore("food_drinks", "story_of"));
  assert.deepEqual(HOMEPAGE_DESK_ORDER, [
    "local_events",
    "activities",
    "food_drinks",
    "story_of",
  ]);
});
