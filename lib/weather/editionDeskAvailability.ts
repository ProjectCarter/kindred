/**
 * Which homepage desks have verified picks today — used to ground weather planning copy.
 */

import type { RankedDiscoveryItem } from "../edition/discovery.ts";
import { classifyActivityDiversityCategory } from "../edition/activitiesHomepage.ts";
import { inferFoodDrinkCollection } from "../edition/foodDrinkCollections.ts";

const INDOOR_ACTIVITY_BUCKETS = new Set([
  "escape_rooms",
  "bowling",
  "arcades",
  "laser_tag",
  "rock_climbing",
  "mini_golf",
  "ice_skating",
  "karaoke",
  "billiards",
  "roller_skating",
  "batting_cages",
  "go_karts",
]);

const OUTDOOR_ACTIVITY_BUCKETS = new Set([
  "hiking",
  "park",
  "beach",
  "botanical_garden",
  "scenic",
  "pickleball",
  "water_recreation",
]);

export type EditionDeskAvailability = {
  localEvents: boolean;
  foodDrinks: boolean;
  coffeeShops: boolean;
  museums: boolean;
  hiking: boolean;
  parks: boolean;
  outdoorActivities: boolean;
  indoorActivities: boolean;
};

export function analyzeEditionDeskAvailability(input: {
  activities: readonly RankedDiscoveryItem[];
  foodDrinks: readonly RankedDiscoveryItem[];
  localEventsCount: number;
}): EditionDeskAvailability {
  const buckets = new Set(
    input.activities.map((item) => classifyActivityDiversityCategory(item))
  );

  const coffeeShops = input.foodDrinks.some(
    (item) =>
      item.item.category === "coffee" ||
      inferFoodDrinkCollection(item.item) === "coffee_cafes"
  );

  return {
    localEvents: input.localEventsCount > 0,
    foodDrinks: input.foodDrinks.length > 0,
    coffeeShops,
    museums: buckets.has("museums"),
    hiking: buckets.has("hiking"),
    parks: buckets.has("park") || buckets.has("botanical_garden"),
    outdoorActivities: [...buckets].some((bucket) =>
      OUTDOOR_ACTIVITY_BUCKETS.has(bucket)
    ),
    indoorActivities: [...buckets].some((bucket) =>
      INDOOR_ACTIVITY_BUCKETS.has(bucket)
    ),
  };
}
