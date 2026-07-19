import test from "node:test";
import assert from "node:assert/strict";
import {
  FOOD_DRINK_CUISINE_EMOJI,
  resolveFoodDrinkCuisineEmoji,
} from "./foodDrinkCuisineEmoji.ts";

test("pizza restaurant resolves to 🍕 not 🍽️", () => {
  assert.equal(
    resolveFoodDrinkCuisineEmoji({
      title: "Grimaldi's Pizzeria",
      category: "restaurants",
    }),
    FOOD_DRINK_CUISINE_EMOJI.pizza
  );
});

test("taco shop resolves to 🌮 before generic mexican", () => {
  assert.equal(
    resolveFoodDrinkCuisineEmoji({
      title: "Los Betos Taqueria",
      category: "restaurants",
    }),
    FOOD_DRINK_CUISINE_EMOJI.tacos
  );
});

test("burrito bar resolves to 🌯", () => {
  assert.equal(
    resolveFoodDrinkCuisineEmoji({
      title: "Burrito Bar & Grill",
      category: "restaurants",
    }),
    FOOD_DRINK_CUISINE_EMOJI.burritos
  );
});

test("ramen shop resolves to 🍜", () => {
  assert.equal(
    resolveFoodDrinkCuisineEmoji({
      title: "Shoyu Ramen House",
      category: "restaurants",
    }),
    FOOD_DRINK_CUISINE_EMOJI.ramen
  );
});

test("oyster bar resolves to 🦪", () => {
  assert.equal(
    resolveFoodDrinkCuisineEmoji({
      title: "The Pearl Oyster Bar",
      category: "restaurants",
    }),
    FOOD_DRINK_CUISINE_EMOJI.oyster_bar
  );
});

test("fine dining resolves to 🍴", () => {
  assert.equal(
    resolveFoodDrinkCuisineEmoji({
      title: "Atlas Fine Dining",
      category: "restaurants",
    }),
    FOOD_DRINK_CUISINE_EMOJI.fine_dining
  );
});

test("generic restaurant name falls back to 🍽️", () => {
  assert.equal(
    resolveFoodDrinkCuisineEmoji({
      title: "The Local Table",
      category: "restaurants",
    }),
    FOOD_DRINK_CUISINE_EMOJI.restaurant
  );
});

test("burger joint resolves to 🍔", () => {
  assert.equal(
    resolveFoodDrinkCuisineEmoji({
      title: "Five Guys Burgers",
      category: "restaurants",
      editorialCategoryId: "restaurant",
    }),
    FOOD_DRINK_CUISINE_EMOJI.burgers
  );
});

test("coffee discovery category resolves to ☕", () => {
  assert.equal(
    resolveFoodDrinkCuisineEmoji({
      title: "Morning Room",
      category: "coffee",
    }),
    FOOD_DRINK_CUISINE_EMOJI.coffee
  );
});
