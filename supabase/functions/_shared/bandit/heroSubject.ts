/**
 * Bandit's Pick hero subjects — photography must match the headline.
 * genericOk: true only when a city skyline / seasonal mood shot is honest.
 */

export type BanditHeroSubject = {
  momentId: string;
  genericOk: boolean;
  /** Primary search title for editorial image selection. */
  searchTitle: string;
  /** Supporting dek for classification. */
  searchDek: string;
  /** Headline keywords that must align with the photograph. */
  headlinePattern: RegExp;
  /** Verified topic photograph when stock search cannot match. */
  verifiedImageUrl?: string;
};

export const BANDIT_HERO_SUBJECTS: Record<string, BanditHeroSubject> = {
  blueberry_season: {
    momentId: "blueberry_season",
    genericOk: false,
    searchTitle: "Blueberry u-pick farm fresh berries",
    searchDek: "People picking blueberries at a farm, baskets of fresh blueberries on bushes",
    headlinePattern: /blueberr/i,
    verifiedImageUrl:
      "https://images.pexels.com/photos/8420091/pexels-photo-8420091.jpeg?auto=compress&cs=tinysrgb&w=1600",
  },
  strawberry_season: {
    momentId: "strawberry_season",
    genericOk: false,
    searchTitle: "Strawberry field u-pick harvest",
    searchDek: "Fresh strawberries in baskets and strawberry rows at a farm",
    headlinePattern: /strawberr/i,
  },
  peach_season: {
    momentId: "peach_season",
    genericOk: false,
    searchTitle: "Peach orchard ripe peaches on trees",
    searchDek: "Ripe peaches at a farm stand or orchard in summer",
    headlinePattern: /peach/i,
  },
  firefly_season: {
    momentId: "firefly_season",
    genericOk: false,
    searchTitle: "Fireflies glowing at dusk in meadow",
    searchDek: "Fireflies lighting up a summer evening field",
    headlinePattern: /firefl/i,
  },
  wildflower_bloom: {
    momentId: "wildflower_bloom",
    genericOk: false,
    searchTitle: "Wildflower meadow in full bloom",
    searchDek: "Colorful wildflowers blooming in an open field",
    headlinePattern: /wildflower|bloom/i,
  },
  cherry_blossoms: {
    momentId: "cherry_blossoms",
    genericOk: false,
    searchTitle: "Cherry blossom trees in bloom",
    searchDek: "Pink cherry blossoms on branches in spring",
    headlinePattern: /blossom|cherry/i,
  },
  lavender_bloom: {
    momentId: "lavender_bloom",
    genericOk: false,
    searchTitle: "Lavender field purple rows",
    searchDek: "Purple lavender blooming in a farm field",
    headlinePattern: /lavender/i,
  },
  pumpkin_patches: {
    momentId: "pumpkin_patches",
    genericOk: false,
    searchTitle: "Pumpkin patch farm autumn",
    searchDek: "Pumpkins in a field at a family pumpkin patch",
    headlinePattern: /pumpkin/i,
  },
  meteor_showers: {
    momentId: "meteor_showers",
    genericOk: false,
    searchTitle: "Perseid meteor shower night sky",
    searchDek: "Meteors streaking across a dark starry night sky",
    headlinePattern: /perseid|meteor/i,
  },
  apple_picking: {
    momentId: "apple_picking",
    genericOk: false,
    searchTitle: "Apple orchard picking apples",
    searchDek: "Apple trees with ripe apples at a u-pick orchard",
    headlinePattern: /apple pick/i,
  },
  butterfly_season: {
    momentId: "butterfly_season",
    genericOk: false,
    searchTitle: "Monarch butterflies on flowers",
    searchDek: "Butterflies resting on wildflowers during migration",
    headlinePattern: /butterfl/i,
  },
  sunflower_bloom: {
    momentId: "sunflower_bloom",
    genericOk: false,
    searchTitle: "Sunflower field golden bloom",
    searchDek: "Tall sunflowers in a bright summer field",
    headlinePattern: /sunflower/i,
  },
  holiday_market: {
    momentId: "holiday_market",
    genericOk: false,
    searchTitle: "Outdoor holiday Christmas market",
    searchDek: "Holiday market stalls with lights and winter shoppers",
    headlinePattern: /holiday market/i,
  },
  christmas_lights: {
    momentId: "christmas_lights",
    genericOk: false,
    searchTitle: "Holiday lights on houses at night",
    searchDek: "Neighborhood Christmas lights glowing after dark",
    headlinePattern: /holiday lights|lights begin/i,
  },
  early_lights: {
    momentId: "early_lights",
    genericOk: false,
    searchTitle: "Holiday lights going up downtown",
    searchDek: "Christmas lights being lit on storefronts and trees",
    headlinePattern: /lights going up|lights begin/i,
  },
  farmers_markets_reopen: {
    momentId: "farmers_markets_reopen",
    genericOk: false,
    searchTitle: "Farmers market fresh produce stalls",
    searchDek: "Saturday farmers market with local produce and flowers",
    headlinePattern: /market/i,
  },
  harvest_peak: {
    momentId: "harvest_peak",
    genericOk: false,
    searchTitle: "Harvest farmers market peak produce",
    searchDek: "Peak harvest vegetables and fruit at a local market",
    headlinePattern: /harvest|market/i,
  },
  tomato_season: {
    momentId: "tomato_season",
    genericOk: false,
    searchTitle: "Heirloom tomatoes fresh harvest",
    searchDek: "Ripe summer tomatoes at a farm stand or market",
    headlinePattern: /tomato/i,
  },
  apple_cider_donuts: {
    momentId: "apple_cider_donuts",
    genericOk: false,
    searchTitle: "Apple cider donuts at farm stand",
    searchDek: "Fresh cider donuts at an autumn orchard stand",
    headlinePattern: /cider donut/i,
  },
  fall_foliage: {
    momentId: "fall_foliage",
    genericOk: false,
    searchTitle: "Peak autumn fall foliage forest",
    searchDek: "Colorful autumn leaves on trees in peak fall color",
    headlinePattern: /fall color|peak color|foliage/i,
  },
  cider_season: {
    momentId: "cider_season",
    genericOk: false,
    searchTitle: "Apple cider mill autumn orchard",
    searchDek: "Fresh apple cider at a countryside mill or orchard",
    headlinePattern: /cider season/i,
  },
  citrus_season: {
    momentId: "citrus_season",
    genericOk: false,
    searchTitle: "Citrus grove oranges on trees",
    searchDek: "Ripe citrus fruit hanging on orchard trees",
    headlinePattern: /citrus/i,
  },
  fresh_start_january: {
    momentId: "fresh_start_january",
    genericOk: true,
    searchTitle: "Quiet winter morning light",
    searchDek: "Soft calm morning at the start of a new year",
    headlinePattern: /quietest week|new year/i,
  },
  quiet_year_end: {
    momentId: "quiet_year_end",
    genericOk: true,
    searchTitle: "Quiet winter evening calm",
    searchDek: "Peaceful end-of-year winter atmosphere",
    headlinePattern: /quiet stretch/i,
  },
  longest_days: {
    momentId: "longest_days",
    genericOk: true,
    searchTitle: "Long summer evening golden hour",
    searchDek: "Golden summer sunlight on the longest days of the year",
    headlinePattern: /longest day/i,
  },
  first_cool_morning: {
    momentId: "first_cool_morning",
    genericOk: true,
    searchTitle: "Cool autumn morning hike trail",
    searchDek: "First crisp fall morning on a wooded trail",
    headlinePattern: /cool morning|first cool/i,
  },
  early_spring_thaw: {
    momentId: "early_spring_thaw",
    genericOk: true,
    searchTitle: "Early spring thaw budding trees",
    searchDek: "Late winter thaw with early signs of spring",
    headlinePattern: /thaw|spring/i,
  },
};

export function momentIdFromBanditPickId(pickId: string): string | null {
  const match = pickId.match(/^bandit_seasonal_(.+)$/);
  return match?.[1] ?? null;
}

export function heroSubjectForMoment(momentId: string): BanditHeroSubject | null {
  return BANDIT_HERO_SUBJECTS[momentId] ?? null;
}

/** Infer a subject from headline when the pick is an event, not a calendar moment. */
export function heroSubjectForHeadline(headline: string): BanditHeroSubject | null {
  const hay = headline.trim();
  if (!hay) return null;
  for (const subject of Object.values(BANDIT_HERO_SUBJECTS)) {
    if (subject.headlinePattern.test(hay)) return subject;
  }
  if (/\bfestival\b|\bfair\b/i.test(hay)) {
    return {
      momentId: "festival_event",
      genericOk: false,
      searchTitle: headline,
      searchDek: "Local festival crowd and colorful outdoor fair",
      headlinePattern: /festival|fair/i,
    };
  }
  return null;
}

export function headlineMatchesHeroSubject(
  headline: string,
  subject: BanditHeroSubject | null
): boolean {
  if (!subject) return true;
  return subject.headlinePattern.test(headline);
}
